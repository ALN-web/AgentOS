"""Live mission execution runner with cross-app data passing and idempotency.

Every step (#6):
1. inputs are resolved from dependencies and the user's preferences applied;
2. the policy engine decides: refused (skipped, re-planned), needs approval, or runs;
3. the tool runs against the real app when connected, else as a marked simulation;
4. failures are classified; transient ones are retried at most twice;
5. real results are re-read from the app independently before counting as proof.
Budgets cap the tool calls per mission and the time a single run may take.
"""

import re
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.capabilities import TASK_TYPES
from app.core.errors import AppError
from app.db.models import (
    Approval,
    Evidence,
    Mission,
    Task,
    TaskDependency,
    Tool as ToolModel,
    ToolExecution,
    User,
    AgentExecution,
)
from app.domain import EventType, MissionStatus, RiskLevel, TaskStatus

from app.integrations.google import GoogleConnector
from app.policy.engine import decide
from app.schemas.plan import check_no_secrets_or_tokens, redact_dict
from app.services.missions import append_event, get_mission
from app.services.preferences import UnknownGroupError, apply_preferences, load_preferences
from app.tools.base import Tool, ToolContext, ToolResult
from app.tools.registry import get_tool, get_simulated_tool, resolve
from app.services.agents import AgentContext, resolve_agent_for_task


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def resolve_inputs(data: Any, completed_outputs: dict[str, dict[str, Any]]) -> Any:
    """Resolve data passing references: <task_id>.output.<field>."""
    if isinstance(data, dict):
        return {k: resolve_inputs(v, completed_outputs) for k, v in data.items()}
    elif isinstance(data, list):
        return [resolve_inputs(item, completed_outputs) for item in data]
    elif isinstance(data, str):
        trimmed = data.strip()
        # Direct reference: "p3.output.html_link"
        m = re.match(r"^([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)$", trimmed)
        if m:
            dep_id = m.group(1)
            field_name = m.group(2)
            dep_output = completed_outputs.get(dep_id, {})
            val = dep_output.get(field_name)
            return val if val is not None else ""

        # Templated or embedded reference: "Event: p3.output.html_link" or "{p3.output.html_link}"
        def repl(match):
            tid = match.group(1)
            fld = match.group(2)
            return str(completed_outputs.get(tid, {}).get(fld, ""))

        return re.sub(r"\{?([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)\}?", repl, data)
    return data


# Failure classes worth another attempt; everything else fails fast.
TRANSIENT_ERRORS = {"rate_limited", "service_unavailable", "timeout", "network_error"}
MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 1.0
# Budgets: at most this many tool calls per mission, and this long per run.
MAX_TOOL_CALLS_PER_MISSION = 30
MAX_RUN_SECONDS = 120.0


def _fail(db: Session, mission: Mission, task: Task, error_class: str, message: str, *, pause: bool = False) -> Mission:
    """Stop the mission at this task. `pause` leaves it resumable (fix it, then start again)."""
    task.status = TaskStatus.FAILED
    task.finished_at = utcnow()
    mission.status = MissionStatus.PAUSED if pause else MissionStatus.FAILED
    append_event(db, mission, EventType.TASK_FAILED, task.agent, {"task_key": task.key, "error_class": error_class, "message": message})
    if not pause:
        append_event(db, mission, EventType.MISSION_FAILED, "planner", {"status": "failed", "summary": message})
    db.commit()
    return mission


def _skip(db: Session, mission: Mission, task: Task, strategy: str, reason: str) -> None:
    task.status = TaskStatus.SKIPPED
    task.finished_at = utcnow()
    append_event(db, mission, EventType.PLAN_UPDATED, "planner", {"task_key": task.key, "strategy": strategy, "reason": reason})
    db.commit()


def _tool_calls(db: Session, mission: Mission) -> int:
    return db.scalar(select(func.count()).select_from(ToolExecution).where(ToolExecution.mission_id == mission.id)) or 0


class PauseExecution(Exception):
    def __init__(self, mission: Mission):
        self.mission = mission


def run_mission(db: Session, user: User, mission_id: str, google: GoogleConnector | None = None) -> Mission:
    """Execute or resume a mission task by task, respecting policy, approvals and idempotency."""
    mission = get_mission(db, user, mission_id)

    if mission.status in (MissionStatus.COMPLETED, MissionStatus.CANCELLED):
        return mission

    if mission.status == MissionStatus.PLANNED:
        mission.status = MissionStatus.RUNNING
        mission.started_at = utcnow()
        append_event(db, mission, EventType.MISSION_STARTED, "planner", {"status": "running"})
        db.commit()
    elif mission.status in (MissionStatus.FAILED, MissionStatus.PAUSED):
        mission.status = MissionStatus.RUNNING
        db.commit()

    deadline = time.monotonic() + MAX_RUN_SECONDS
    prefs = load_preferences(db, user)
    google_live = google is not None and google.configured
    google_client = google.client_for(db, user) if google_live else None

    # Collect outputs from already completed tasks
    completed_outputs: dict[str, dict[str, Any]] = {
        t.key: (t.output or {}) for t in mission.tasks if t.status == TaskStatus.DONE
    }

    for task in mission.tasks:
        # Partial failure / Idempotency: skip tasks already completed
        if task.status in (TaskStatus.DONE, TaskStatus.SKIPPED):
            continue
        if time.monotonic() > deadline:
            return _fail(db, mission, task, "budget_exceeded", "This run hit its time limit and was paused. Start it again to continue.", pause=True)

        is_verification = task.type == "verify" or task.capability == "verification"

        # Resolve inputs from dependencies
        resolved_inputs = resolve_inputs(task.inputs or {}, completed_outputs)
        check_no_secrets_or_tokens(resolved_inputs)
        task.inputs = resolved_inputs

        agent = resolve_agent_for_task(task)
        if not agent:
            return _fail(db, mission, task, "tool_unavailable", f"No agent available for capability: {task.capability}")

        if agent.id != "verification" and any(d.depends_on.status == TaskStatus.SKIPPED for d in task.dependencies):
            _skip(db, mission, task, "skipped_dependency_skipped", "A step this depends on was skipped.")
            continue

        agent_exec = db.scalar(select(AgentExecution).where(
            AgentExecution.task_id == task.id,
            AgentExecution.status == "running"
        ))
        if not agent_exec:
            agent_exec = AgentExecution(
                mission_id=mission.id,
                task_id=task.id,
                agent_id=agent.id,
                status="running",
                started_at=utcnow()
            )
            db.add(agent_exec)
            db.flush()
            append_event(db, mission, EventType.AGENT_ASSIGNED, agent.id, {"task_key": task.key, "agent": agent.id})
            db.commit()

        def execute_tool_callback(tool_name: str, args: dict[str, Any]) -> ToolResult:
            if not tool_name or tool_name == "none":
                return ToolResult(status="failed", tool="", error_class="tool_unavailable")

            real = google_live
            if not real:
                tool = get_simulated_tool(tool_name) or get_tool(tool_name)
                if not tool:
                    # Simulated success
                    task.status = TaskStatus.DONE
                    task.started_at = task.started_at or utcnow()
                    task.finished_at = utcnow()
                    sim_output = {"simulated": True, "title": task.title}
                    append_event(db, mission, EventType.TASK_STARTED, agent.id, {"task_key": task.key, "simulated": True})
                    append_event(
                        db, mission, EventType.TOOL_COMPLETED, agent.id,
                        {"task_key": task.key, "tool": None, "status": "success", "simulated": True, "output": sim_output, "evidence": []},
                    )
                    db.commit()
                    return ToolResult(status="success", tool="", output=sim_output, simulated=True)
            else:
                # Live Mode
                resolution = resolve(tool_name, db, user)
                if not resolution.available:
                    reason = resolution.reason or "tool_unavailable"
                    pause = reason == "not_connected"
                    _fail(db, mission, task, reason, "Could not use the tool. Connect the required integration and try again." if pause else "The required tool is unavailable.", pause=pause)
                    raise PauseExecution(mission)
                tool = resolution.tool
                if not tool:
                    _fail(db, mission, task, "tool_unavailable", "Tool not found.")
                    raise PauseExecution(mission)

            # Apply user preferences
            try:
                args, applied_prefs = apply_preferences(tool.name, args, prefs)
            except UnknownGroupError as err:
                task.status = TaskStatus.FAILED
                task.finished_at = utcnow()
                mission.status = MissionStatus.PAUSED
                append_event(
                    db, mission, EventType.TASK_FAILED, agent.id,
                    {"task_key": task.key, "error_class": "needs_clarification", "message": err.question, "group": err.group},
                )
                db.commit()
                raise PauseExecution(mission)

            task.inputs = args

            # 1. Existing Approval Gateway
            existing_approval = db.scalar(select(Approval).where(Approval.task_id == task.id))
            if existing_approval:
                if existing_approval.status == "pending":
                    task.status = TaskStatus.AWAITING
                    mission.status = MissionStatus.AWAITING_APPROVAL
                    db.commit()
                    raise PauseExecution(mission)
                elif existing_approval.status == "rejected":
                    _skip(db, mission, task, "skipped_due_to_rejection", "You rejected this action, so it was not performed.")
                    return ToolResult(status="failed", tool=tool.name, error_class="skipped_due_to_rejection")
                elif existing_approval.status in ("approved", "edited"):
                    if existing_approval.payload_json:
                        args.update(existing_approval.payload_json)
                        task.inputs = args
                else:
                    _skip(db, mission, task, "skipped_approval_closed", f"The approval was {existing_approval.status}.")
                    return ToolResult(status="failed", tool=tool.name, error_class="skipped_approval_closed")

            # 2. Policy Engine
            decision = decide(db, user, real, tool, task.gated, args)
            if not decision.permitted:
                refusal = decision.reason or "Permission denied."
                error_class = decision.error_class or "permission_denied"
                append_event(db, mission, EventType.TASK_FAILED, agent.id, {"task_key": task.key, "error_class": error_class, "message": refusal})
                _skip(db, mission, task, "skipped_permission_denied", refusal)
                return ToolResult(status="failed", tool=tool.name, error_class=error_class)

            # 3. New Approval Gateway
            if decision.requires_approval and not existing_approval:
                approval = Approval(
                    mission_id=mission.id, task_id=task.id, tool_name=tool.name, risk=str(tool.risk),
                    category="External action", reason=f"Action '{tool.name}' interacts with an external app and requires approval.",
                    payload_json=redact_dict(args), original_payload_json=redact_dict(args), status="pending",
                )
                db.add(approval)
                task.status = TaskStatus.AWAITING
                mission.status = MissionStatus.AWAITING_APPROVAL
                db.flush()
                append_event(
                    db, mission, EventType.APPROVAL_REQUESTED, "approval",
                    {"approval_id": approval.id, "task_key": task.key, "tool": tool.name, "risk": str(tool.risk),
                     "category": approval.category, "reason": approval.reason, "payload": redact_dict(args),
                     "applied_preferences": applied_prefs, "simulated": not real},
                )
                db.commit()
                raise PauseExecution(mission)

            if _tool_calls(db, mission) >= MAX_TOOL_CALLS_PER_MISSION:
                _fail(db, mission, task, "budget_exceeded", f"This mission used its budget of {MAX_TOOL_CALLS_PER_MISSION} tool calls.")
                raise PauseExecution(mission)

            # Execute Tool
            task.status = TaskStatus.RUNNING
            task.started_at = utcnow()
            append_event(db, mission, EventType.TASK_STARTED, agent.id, {"task_key": task.key, "simulated": not real})
            append_event(
                db, mission, EventType.TOOL_CALLED, agent.id,
                {"task_key": task.key, "tool": tool.name, "risk": str(tool.risk), "applied_preferences": applied_prefs},
            )

            if db.get(ToolModel, tool.name) is None:
                db.add(ToolModel(name=tool.name, capability=tool.capability, risk=str(tool.risk), description=tool.description))
                db.flush()

            ctx_tool = ToolContext(
                user_id=user.id, mission_id=mission.id, task_id=task.id, db=db,
                idempotency_key=f"{mission.id}:{task.key}", preferences=prefs.as_client(),
                google=google_client if tool.integration == "google" else None,
            )

            result, message, te = None, "Tool execution failed", None
            for attempt in range(1, MAX_RETRIES + 2):
                te = ToolExecution(
                    mission_id=mission.id, task_id=task.id, tool_name=tool.name, risk=str(tool.risk),
                    input_json=redact_dict(args), status="running", attempt=attempt,
                )
                db.add(te)
                db.flush()
                try:
                    result = tool.execute(ctx_tool, args)
                except Exception as exc:
                    result = ToolResult(status="failed", tool=tool.name, error_class=tool.classify(exc))
                    message = getattr(exc, "message", None) or "The tool failed unexpectedly."
                te.finished_at = utcnow()
                if result.status == "success":
                    break
                te.status, te.error_class = "failed", result.error_class
                if (result.error_class in TRANSIENT_ERRORS and attempt <= MAX_RETRIES
                    and _tool_calls(db, mission) < MAX_TOOL_CALLS_PER_MISSION and time.monotonic() < deadline):
                    append_event(
                        db, mission, EventType.RECOVERY_STARTED, "recovery",
                        {"task_key": task.key, "strategy": "retry", "attempt": attempt + 1, "error_class": result.error_class},
                    )
                    db.commit()
                    time.sleep(RETRY_BACKOFF_SECONDS * attempt)
                    continue
                break

            if result.status != "success":
                _fail(db, mission, task, result.error_class or "execution_failed", message, pause=result.error_class == "authentication_failed")
                raise PauseExecution(mission)

            try:
                verification = tool.verify(ctx_tool, result)
            except Exception as exc:
                verification = {"verified": False, "error_class": tool.classify(exc), "detail": getattr(exc, "message", None) or "Could not re-read the result."}
            result.verification = verification

            te.status = "success"
            te.output_json = redact_dict(result.output)

            # Proof status (#14): verified by an independent re-read, or failed.
            ok = bool(verification.get("verified") or verification.get("simulated"))
            ev_status = "verified" if ok else "failed"
            ev_verified_at = utcnow() if ok else None
            ev_method = verification.get("method") or verification.get("detail")
            for ev in result.evidence:
                db.add(Evidence(
                    mission_id=mission.id, task_id=task.id, tool_execution_id=te.id,
                    type=ev.get("type", "proof"), source=ev.get("source", tool.name),
                    reference_id=ev.get("reference_id"), label=ev.get("label", ""), url=ev.get("url"),
                    status=ev.get("status") or ev_status,
                    verified_at=ev.get("verified_at") or ev_verified_at,
                    method=ev.get("method") or ev_method,
                ))

            # A sent draft no longer exists in Drafts: its proof points to the sent email instead.
            if tool.name == "gmail.send_draft" and not result.simulated and args.get("draft_id"):
                for draft_ev in db.scalars(select(Evidence).where(
                    Evidence.mission_id == mission.id, Evidence.type == "gmail_draft", Evidence.reference_id == args["draft_id"],
                )):
                    draft_ev.url = None
                    draft_ev.method = "the draft was sent (see the sent email)"

            append_event(
                db, mission, EventType.TOOL_COMPLETED, agent.id,
                {"task_key": task.key, "tool": tool.name, "status": "success", "simulated": result.simulated,
                 "output": redact_dict(result.output), "evidence": result.evidence, "verification": verification},
            )
            db.commit()
            return result


        ctx = AgentContext(db, user, mission, task, resolved_inputs, execute_tool_callback)

        try:
            result = agent.run(ctx)
        except PauseExecution as e:
            return e.mission

        agent_exec.finished_at = utcnow()
        agent_exec.status = "completed" if result.status == "success" else "failed"

        if task.status not in (TaskStatus.FAILED, TaskStatus.SKIPPED):
            task.status = TaskStatus.DONE if result.status == "success" else TaskStatus.FAILED
            task.finished_at = utcnow()

            output_dict = result.output or {}
            if hasattr(result, "verification") and result.verification:
                output_dict = {**output_dict, "verification": result.verification}
            if getattr(result, "simulated", False):
                output_dict = {**output_dict, "simulated": True}

            task.output = output_dict
            completed_outputs[task.key] = task.output

            if result.status == "failed" and agent.id == "verification":
                return _fail(db, mission, task, result.error_class or "verification_failed", "Verification failed.")

            if result.status == "failed":
                return _fail(db, mission, task, result.error_class or "execution_failed", "Agent execution failed.")

        db.commit()

    if all(t.status in (TaskStatus.DONE, TaskStatus.SKIPPED) for t in mission.tasks):
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = utcnow()
        skipped = sum(1 for t in mission.tasks if t.status == TaskStatus.SKIPPED)

        # Check open verifications
        open_items = []
        for t in mission.tasks:
            if t.capability == "verification":
                criteria = (t.output or {}).get("criteria", [])
                open_items.extend(c for c in criteria if c.get("open"))

        summary = "All tasks completed."
        if skipped:
            summary = f"Completed; {skipped} step(s) skipped by your decisions."
        if open_items:
            summary = f"Mission completed; {len(open_items)} criterion(s) left open because a step was not approved."

        append_event(db, mission, EventType.MISSION_COMPLETED, "planner", {"status": "completed", "summary": summary})
        db.commit()

    return mission


def handle_approval_decision(
    db: Session,
    user: User,
    approval_id: str,
    decision: str,
    edits: dict[str, Any] | None = None,
    google: GoogleConnector | None = None,
    input_type: str = "click",
) -> Approval:
    """Approve, edit or reject; then resume the mission. A decision is accepted only
    while the approval is still pending, so it cannot be replayed or changed."""
    stmt = (
        select(Approval)
        .join(Mission, Approval.mission_id == Mission.id)
        .where(Approval.id == approval_id, Mission.user_id == user.id)
        .options(selectinload(Approval.mission))
    )
    approval = db.scalar(stmt)
    if approval is None:
        raise AppError("approval_not_found", "Approval request not found.", status_code=404)

    if approval.status != "pending":
        raise AppError("approval_already_decided", f"Approval is already {approval.status}.", status_code=409)

    mission = approval.mission
    approval.decided_at = utcnow()
    approval.decided_by = user.id

    if decision == "approve":
        approval.status = "approved"
        approval.input = input_type
        append_event(db, mission, EventType.APPROVAL_GRANTED, "approval", {"approval_id": approval.id, "edited": False})
    elif decision == "edit":
        approval.status = "edited"
        approval.input = input_type
        if edits:
            check_no_secrets_or_tokens(edits)
            updated_payload = {**(approval.payload_json or {}), **edits}

            # Validate against tool's input_model
            from app.tools.registry import get_tool
            tool = get_tool(approval.tool_name)
            if tool and getattr(tool, "input_model", None):
                try:
                    tool.input_model(**updated_payload)
                except Exception as exc:
                    raise AppError("validation_error", f"Invalid edits: {exc}", status_code=422)

            approval.payload_json = updated_payload

        append_event(db, mission, EventType.APPROVAL_GRANTED, "approval", {"approval_id": approval.id, "edited": True})
    elif decision == "reject":
        approval.status = "rejected"
        approval.input = input_type
        append_event(db, mission, EventType.APPROVAL_REJECTED, "approval", {"approval_id": approval.id, "edited": False})
    else:
        raise AppError("invalid_decision", f"Invalid decision '{decision}'.", status_code=422)

    mission.status = MissionStatus.RUNNING
    db.commit()
    # Resume: an approved step runs; a rejected one is skipped and the plan continues.
    run_mission(db, user, mission.id, google)
    return approval


def cancel_mission(db: Session, user: User, mission_id: str) -> Mission:
    mission = get_mission(db, user, mission_id)
    if mission.status in (MissionStatus.COMPLETED, MissionStatus.CANCELLED):
        return mission
    for a in db.scalars(select(Approval).where(Approval.mission_id == mission.id, Approval.status == "pending")):
        a.status = "cancelled"
        a.decided_at = utcnow()
        a.decided_by = user.id
    for t in mission.tasks:
        if t.status in (TaskStatus.PENDING, TaskStatus.AWAITING, TaskStatus.RUNNING):
            t.status = TaskStatus.SKIPPED
    mission.status = MissionStatus.CANCELLED
    append_event(db, mission, EventType.PLAN_UPDATED, "planner", {"task_key": None, "strategy": "cancelled", "reason": "You cancelled the mission."})
    db.commit()
    return mission
