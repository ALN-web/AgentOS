import copy
import json
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.capabilities import CAPABILITIES, CAPABILITY_BY_ID, TASK_TYPES
from app.db.migrate import alembic_config
from app.main import create_app
from tests.conftest import make_settings

FIXTURES = Path(__file__).parent / "fixtures"
FRONTEND_REGISTRY = json.loads((FIXTURES / "capabilities.json").read_text(encoding="utf-8"))


def plan_body(name: str, **extra) -> dict:
    fx = json.loads((FIXTURES / "plans" / f"{name}.json").read_text(encoding="utf-8"))
    return {"goal": fx["goal"], "plan": copy.deepcopy(fx["plan"]), **extra}


# ---------------------------------------------------------------- #9 registry

def test_python_registry_matches_the_frontend_registry():
    ours = [{"id": c.id, "name": c.name, "agent": c.agent, "external": c.external} for c in CAPABILITIES]
    assert ours == FRONTEND_REGISTRY["capabilities"]
    assert TASK_TYPES == FRONTEND_REGISTRY["taskTypes"]


def test_everyday_capabilities_exist_and_are_approval_gated():
    for cap_id in ("calendar", "email", "reminders"):
        cap = CAPABILITY_BY_ID[cap_id]
        assert cap.external
        assert cap.risk == "HIGH"
    assert "calendar.create_event" in CAPABILITY_BY_ID["calendar"].tool_bindings
    assert "gmail.send_draft" in CAPABILITY_BY_ID["email"].tool_bindings


def test_capabilities_endpoint_reports_honest_modes(client):
    res = client.get("/api/capabilities")
    assert res.status_code == 200
    caps = {c["id"]: c for c in res.json()}
    assert {"calendar", "email", "reminders"} <= set(caps)
    assert caps["email"]["requires_approval"] is True
    assert caps["research"]["requires_approval"] is False
    # No real tools are registered yet: everything is simulated, nothing claims to be live.
    assert all(c["mode"] == "simulated" and c["live_tools"] == [] for c in caps.values())


# ---------------------------------------------------------------- #9 plan rules

def _first(plan, capability):
    return next(t for t in plan["tasks"] if t.get("capability") == capability)


@pytest.mark.parametrize("name", ["dinner", "week"])
def test_everyday_plans_are_accepted(client, name):
    res = client.post("/api/missions", json=plan_body(name))
    assert res.status_code == 201, res.text


def test_external_task_without_approval_is_rejected(client):
    req = plan_body("dinner")
    task = _first(req["plan"], "calendar")
    task["gated"] = False
    req["plan"]["approvalPoints"] -= 1
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert "must require approval" in json.dumps(res.json())


@pytest.mark.parametrize(
    "field, value, message",
    [("capability", "teleport", "unknown capability"), ("type", "hack", "unknown task type")],
)
def test_unknown_capabilities_and_task_types_are_rejected(client, field, value, message):
    req = plan_body("research")
    req["plan"]["tasks"][0][field] = value
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert message in json.dumps(res.json())


# ---------------------------------------------------------------- #17 source

def test_source_defaults_to_typed(client):
    m = client.post("/api/missions", json=plan_body("week")).json()
    assert m["source"] == "typed" and m["template_id"] is None


def test_voice_and_template_sources_are_stored_and_logged(client):
    voice = client.post("/api/missions", json=plan_body("week", source="voice")).json()
    tpl = client.post("/api/missions", json=plan_body("dinner", source="template", template_id="plans-os")).json()
    assert voice["source"] == "voice"
    assert (tpl["source"], tpl["template_id"]) == ("template", "plans-os")
    assert client.get(f"/api/missions/{tpl['id']}").json()["template_id"] == "plans-os"
    created = client.get(f"/api/missions/{voice['id']}/events").json()[0]
    assert created["type"] == "MISSION_CREATED" and created["payload"]["source"] == "voice"
    listed = {m["id"]: m["source"] for m in client.get("/api/missions").json()}
    assert listed[voice["id"]] == "voice"


@pytest.mark.parametrize(
    "extra",
    [
        {"source": "telepathy"},
        {"source": "template"},  # template needs a template_id
        {"source": "typed", "template_id": "inbox-os"},  # template_id only with template
        {"source": "template", "template_id": "../../etc"},
    ],
)
def test_invalid_sources_are_rejected(client, extra):
    res = client.post("/api/missions", json=plan_body("week", **extra))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


def test_migration_adds_source_to_existing_missions(tmp_path):
    """A database created before #17 upgrades cleanly and keeps its missions as 'typed'."""
    url = f"sqlite:///{(tmp_path / 'old.db').as_posix()}"
    command.upgrade(alembic_config(url), "0001")
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO user (id, email, created_at) VALUES ('local', 'local@agentos.dev', CURRENT_TIMESTAMP)"))
        conn.execute(text(
            "INSERT INTO mission (id, user_id, goal, mode, status, plan_json, metric_label, metric_current, metric_target, budget_json, created_at, updated_at) "
            "VALUES ('old1', 'local', 'Old goal', 'live', 'planned', '{}', 'm', 0, 1, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))
    engine.dispose()

    command.upgrade(alembic_config(url), "head")
    engine = create_engine(url)
    assert {"source", "template_id"} <= {c["name"] for c in inspect(engine).get_columns("mission")}
    with engine.connect() as conn:
        assert conn.execute(text("SELECT source, template_id FROM mission WHERE id='old1'")).one() == ("typed", None)
    engine.dispose()
