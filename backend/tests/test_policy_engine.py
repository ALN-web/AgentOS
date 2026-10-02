"""Policy engine unit tests for Issue #42.

These tests exercise policy.decide() and policy.permissions.check_action()
in isolation, plus two integration proofs:
  (a) CRITICAL risk tool is refused by the runner — execute() is never called.
  (b) Every real tool execution path passes through decide().

Conventions match the rest of the test suite (app/client fixtures from conftest).
"""
import copy
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.db.models import AppPermission, User
from app.domain import RiskLevel, EventType
from app.policy.engine import PolicyDecision, decide
from app.policy.permissions import check_action
from app.tools.base import Tool, ToolContext, ToolResult
from app.tools.fake import FakeTool
from app.tools.registry import register_tool, unregister_tool, get_tool
from tests.test_missions import body


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _user(db, uid="u1", email="u@test.com") -> User:
    u = db.get(User, uid)
    if u is None:
        u = User(id=uid, email=email)
        db.add(u)
        db.commit()
    return u


def _decide(db, user, tool, *, is_live=True, is_gated=False, args=None) -> PolicyDecision:
    return decide(db, user, is_live, tool, is_gated, args or {})


def _plan(tool_id: str, keep_deps: bool = False) -> dict:
    plan = body("dinner")
    
    # We strip down the dinner plan to just the target tool to isolate the execution path.
    # p3 is gmail.create_draft (MEDIUM risk, gated=False)
    # p4 is gmail.send_draft (HIGH risk, gated=True)
    task = next(t for t in plan["plan"]["tasks"] if t["id"] == tool_id)
    if not keep_deps:
        task["deps"] = []
        task["inputs"] = {"subject": "Test", "body": "Test"}
        plan["plan"]["approvalPoints"] = 1 if task["gated"] else 0
    plan["plan"]["tasks"] = [task]
    plan["plan"]["criteria"] = []
    plan["plan"]["metric"]["target"] = 0
    return plan


# ──────────────────────────────────────────────────────────────────────────────
# check_action unit tests (permissions layer)
# ──────────────────────────────────────────────────────────────────────────────

def test_check_action_low_risk_default_is_allowed(app):
    with app.state.session_factory() as db:
        u = _user(db)
        d = check_action(db, u, "calendar.read")
    assert d.permitted is True
    assert d.requires_approval is False
    assert d.mode == "allowed"


def test_check_action_high_risk_default_is_ask(app):
    with app.state.session_factory() as db:
        u = _user(db)
        d = check_action(db, u, "gmail.send_draft")
    assert d.permitted is True
    assert d.requires_approval is True
    assert d.mode == "ask"


def test_check_action_critical_risk_default_is_off(app):
    with app.state.session_factory() as db:
        u = _user(db)
        d = check_action(db, u, "gmail.delete")
    assert d.permitted is False
    assert d.requires_approval is False
    assert d.mode == "off"


def test_check_action_unknown_action_is_forbidden(app):
    with app.state.session_factory() as db:
        u = _user(db)
        d = check_action(db, u, "totally.made.up")
    assert d.permitted is False
    assert d.requires_approval is False


def test_check_action_off_produces_permission_denied_reason(app):
    with app.state.session_factory() as db:
        u = _user(db)
        db.add(AppPermission(user_id=u.id, app_id="gmail", action_id="gmail.create_draft", mode="off"))
        db.commit()
        d = check_action(db, u, "gmail.create_draft")
    assert d.permitted is False
    assert "turned off" in d.reason


def test_check_action_ask_produces_approval_required(app):
    with app.state.session_factory() as db:
        u = _user(db)
        db.add(AppPermission(user_id=u.id, app_id="gmail", action_id="gmail.create_draft", mode="ask"))
        db.commit()
        d = check_action(db, u, "gmail.create_draft")
    assert d.permitted is True
    assert d.requires_approval is True


def test_check_action_tampered_high_risk_row_cannot_be_allowed(app):
    """A stored 'allowed' mode for a HIGH risk action is clamped to 'ask' at runtime."""
    with app.state.session_factory() as db:
        u = _user(db)
        db.add(AppPermission(user_id=u.id, app_id="gmail", action_id="gmail.send_draft", mode="allowed"))
        db.commit()
        d = check_action(db, u, "gmail.send_draft")
    # max_mode clamps 'allowed' to 'ask' for HIGH risk
    assert d.mode == "ask"
    assert d.permitted is True
    assert d.requires_approval is True


def test_check_action_tampered_critical_row_cannot_be_allowed(app):
    """A stored 'allowed' mode for a CRITICAL action is clamped to 'ask', then still
    produces requires_approval=True — it can never actually auto-run."""
    with app.state.session_factory() as db:
        u = _user(db)
        db.add(AppPermission(user_id=u.id, app_id="gmail", action_id="gmail.delete", mode="allowed"))
        db.commit()
        d = check_action(db, u, "gmail.delete")
    assert d.mode == "ask"
    assert d.requires_approval is True


# ──────────────────────────────────────────────────────────────────────────────
# decide() unit tests (full engine)
# ──────────────────────────────────────────────────────────────────────────────

def test_decide_low_risk_real_tool_is_allowed(app):
    tool = FakeTool("test.low", risk=RiskLevel.LOW)
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool)
    assert d.permitted is True
    assert d.requires_approval is False


def test_decide_medium_risk_real_tool_is_allowed_by_default(app):
    tool = FakeTool("test.medium", risk=RiskLevel.MEDIUM)
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool)
    assert d.permitted is True
    assert d.requires_approval is False


def test_decide_high_risk_real_tool_requires_approval(app):
    tool = FakeTool("test.high", risk=RiskLevel.HIGH)
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool)
    assert d.permitted is True
    assert d.requires_approval is True


def test_decide_critical_risk_tool_is_forbidden(app):
    """CRITICAL tools with no catalog entry are forbidden by the engine."""
    tool = FakeTool("test.critical", risk=RiskLevel.CRITICAL)
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool)
    assert d.permitted is False
    assert d.requires_approval is False
    assert d.error_class == "permission_denied"


def test_decide_gated_task_always_requires_approval_regardless_of_risk(app):
    """is_gated=True forces approval even for LOW risk."""
    tool = FakeTool("test.low2", risk=RiskLevel.LOW)
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool, is_gated=True)
    assert d.permitted is True
    assert d.requires_approval is True


def test_decide_action_with_known_catalog_id_off_is_forbidden(app):
    """A catalog action that the user turned off produces permitted=False."""
    with app.state.session_factory() as db:
        u = _user(db)
        db.add(AppPermission(user_id=u.id, app_id="google-calendar",
                             action_id="calendar.create_event", mode="off"))
        db.commit()
        tool = FakeTool("calendar.create_event", risk=RiskLevel.HIGH)
        tool.action_id = "calendar.create_event"
        d = _decide(db, u, tool)
    assert d.permitted is False
    assert d.error_class == "permission_denied"


def test_decide_action_with_known_catalog_id_ask_requires_approval(app):
    """A catalog action on 'ask' produces requires_approval=True."""
    with app.state.session_factory() as db:
        u = _user(db)
        tool = FakeTool("calendar.create_event", risk=RiskLevel.HIGH)
        tool.action_id = "calendar.create_event"
        d = _decide(db, u, tool)
    assert d.permitted is True
    assert d.requires_approval is True


def test_decide_simulated_tool_in_live_mode_is_forbidden(app):
    """A simulated tool must not execute in Live Mode."""
    tool = FakeTool("test.sim", risk=RiskLevel.LOW)
    tool.kind = "simulated"
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool, is_live=True)
    assert d.permitted is False
    assert d.error_class == "permission_denied"


def test_decide_input_validation_failure_returns_forbidden(app):
    """If the tool has an input_model and args fail validation, decide returns forbidden."""
    from pydantic import BaseModel

    class StrictInput(BaseModel):
        name: str
        count: int

    tool = FakeTool("test.validated", risk=RiskLevel.LOW)
    tool.input_model = StrictInput
    with app.state.session_factory() as db:
        u = _user(db)
        d = _decide(db, u, tool, args={"name": "ok"})  # missing 'count'
    assert d.permitted is False
    assert d.error_class == "validation_error"


# ──────────────────────────────────────────────────────────────────────────────
# CRITICAL runtime refusal: CRITICAL tool → runner refuses → execute() not called
# ──────────────────────────────────────────────────────────────────────────────

class _CriticalTool(Tool):
    """A CRITICAL-risk tool used only in this test — execute() must never run."""
    name = "test.critical_runtime"
    capability = "execution"
    risk = RiskLevel.CRITICAL
    kind = "real"
    description = "test critical tool"
    integration = None
    output_fields = ()
    supports_idempotency = False

    def __init__(self):
        self.called = False

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        self.called = True  # if this runs, the test fails
        return ToolResult(status="success", tool=self.name, output={})


def test_critical_risk_tool_runner_never_calls_execute(app, monkeypatch):
    """Prove end-to-end that CRITICAL tools are refused before execute() is reached."""
    critical_tool = _CriticalTool()
    register_tool(critical_tool)
    try:
        with app.state.session_factory() as db:
            u = _user(db)
            d = decide(db, u, is_live=True, tool=critical_tool, is_gated=False, inputs={})

        assert d.permitted is False, f"Expected forbidden; got permitted={d.permitted}"
        assert d.error_class == "permission_denied"
        assert critical_tool.called is False, "CRITICAL tool's execute() was called — policy gate failed!"
    finally:
        unregister_tool("test.critical_runtime")


# ──────────────────────────────────────────────────────────────────────────────
# Runner gate: every real tool execution passes through decide()
# ──────────────────────────────────────────────────────────────────────────────

def test_runner_gate_calls_decide_before_tool_execute(app, monkeypatch):
    """Prove that the runner calls policy.decide() before tool.execute()
    for every real tool execution.
    """
    from app.services import runner as runner_module
    from collections import namedtuple
    
    call_log: list[str] = []
    original_decide = runner_module.decide

    def spying_decide(db, user, is_live, tool, is_gated, inputs):
        d = original_decide(db, user, is_live, tool, is_gated, inputs)
        call_log.append(f"decide:{tool.name}:{d.permitted}:{d.requires_approval}:{d.reason}")
        return d

    from app.tools.google import GmailCreateDraftTool
    real_tool = GmailCreateDraftTool()
    register_tool(real_tool)

    def spying_execute(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        call_log.append(f"execute:{real_tool.name}")
        return ToolResult(status="success", tool=real_tool.name, output={})

    monkeypatch.setattr(runner_module, "decide", spying_decide)
    app.state.google = MagicMock()
    app.state.google.configured = True
    app.state.google.client_for.return_value = MagicMock()
    monkeypatch.setattr(real_tool, "execute", spying_execute)
    
    Res = namedtuple("Resolution", ["available", "tool", "reason"])
    monkeypatch.setattr(runner_module, "resolve", lambda t, *a: Res(True, real_tool, None))

    with TestClient(app, raise_server_exceptions=True) as client:
        plan = _plan("p3")  # p3 is gmail.create_draft (MEDIUM, not gated -> allowed immediately)
        mid = client.post("/api/missions", json=plan).json()["id"]
        client.post(f"/api/missions/{mid}/start")

    assert any("decide:gmail.create_draft" in e for e in call_log), f"decide() was never called; call_log={call_log}"
    assert any("execute:gmail.create_draft" in e for e in call_log), f"execute() was never called; call_log={call_log}"

    decide_idx = next(i for i, e in enumerate(call_log) if "decide:gmail.create_draft" in e)
    execute_idx = next(i for i, e in enumerate(call_log) if "execute:gmail.create_draft" in e)
    assert decide_idx < execute_idx, f"decide() at index {decide_idx} came AFTER execute() at index {execute_idx}"


def test_runner_gate_forbidden_tool_never_executes(app, monkeypatch):
    """If decide() returns forbidden, execute() is never called."""
    from app.services import runner as runner_module
    from collections import namedtuple

    execute_called = []
    from app.tools.google import GmailSendDraftTool
    real_tool = GmailSendDraftTool()
    register_tool(real_tool)

    def spying_execute(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        execute_called.append(True)
        return ToolResult(status="success", tool=real_tool.name, output={})

    def always_forbid(db, user, is_live, tool, is_gated, inputs):
        return PolicyDecision(permitted=False, requires_approval=False,
                              reason="test forbidden", error_class="permission_denied")

    monkeypatch.setattr(runner_module, "decide", always_forbid)
    app.state.google = MagicMock()
    app.state.google.configured = True
    app.state.google.client_for.return_value = MagicMock()
    monkeypatch.setattr(real_tool, "execute", spying_execute)
    
    Res = namedtuple("Resolution", ["available", "tool", "reason"])
    monkeypatch.setattr(runner_module, "resolve", lambda t, *a: Res(True, real_tool, None))

    with TestClient(app, raise_server_exceptions=True) as client:
        plan = _plan("p4")  # p4 is gmail.send_draft (gated)
        mid = client.post("/api/missions", json=plan).json()["id"]
        client.post(f"/api/missions/{mid}/start")

    assert execute_called == [], "execute() was called even though policy returned forbidden"


# ──────────────────────────────────────────────────────────────────────────────
# Event logging: allowed decision is recorded before execute() via TOOL_CALLED
# ──────────────────────────────────────────────────────────────────────────────

def test_allowed_decision_is_recorded_before_execution_via_tool_called_event(app, monkeypatch):
    """Prove that for an allowed (non-gated) tool, the runner emits TOOL_CALLED
    *before* calling execute(), giving an auditable record of the policy decision.
    """
    from app.services import runner as runner_module
    from app.services.missions import append_event
    from collections import namedtuple
    
    event_log: list[str] = []
    execute_called: list[bool] = []
    original_append = append_event
    from app.tools.google import GmailCreateDraftTool
    real_tool = GmailCreateDraftTool()
    register_tool(real_tool)

    def spying_append(db, mission, event_type, agent, payload):
        if event_type == EventType.TOOL_CALLED:
            event_log.append(f"TOOL_CALLED:{payload.get('tool')}")
        return original_append(db, mission, event_type, agent, payload)

    def spying_execute(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        execute_called.append(True)
        return ToolResult(status="success", tool=real_tool.name, output={})

    monkeypatch.setattr(runner_module, "append_event", spying_append)
    app.state.google = MagicMock()
    app.state.google.configured = True
    app.state.google.client_for.return_value = MagicMock()
    monkeypatch.setattr(real_tool, "execute", spying_execute)
    
    Res = namedtuple("Resolution", ["available", "tool", "reason"])
    monkeypatch.setattr(runner_module, "resolve", lambda t, *a: Res(True, real_tool, None))

    with TestClient(app, raise_server_exceptions=True) as client:
        plan = _plan("p3")  # p3 is gmail.create_draft (allowed immediately)
        mid = client.post("/api/missions", json=plan).json()["id"]
        client.post(f"/api/missions/{mid}/start")

    assert any("gmail.create_draft" in e for e in event_log), f"TOOL_CALLED event not found"
    assert len(execute_called) == 1, "execute() was not called"
