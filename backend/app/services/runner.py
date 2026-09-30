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
)
from app.domain import EventType, MissionStatus, RiskLevel, TaskStatus

from app.integrations.google import GoogleConnector
from app.policy.engine import decide
from app.schemas.plan import check_no_secrets_or_tokens, redact_dict
from app.services.missions import append_event, get_mission
from app.services.preferences import UnknownGroupError, apply_preferences, load_preferences
from app.tools.base import Tool, ToolContext, ToolResult
from app.tools.registry import get_tool, get_simulated_tool, resolve


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


def find_tool_name_for_task(task: Task) -> str | None:
    """Select the appropriate tool for a task based on registry."""
    # Explicit tool in task inputs or plan
    if task.inputs and isinstance(task.inputs, dict) and "tool" in task.inputs:
        return str(task.inputs["tool"])

    # Check registered tool by task capability or task type
    cap = task.capability or TASK_TYPES.get(task.type or "")

    tool_name = None
    if cap == "calendar":
        title_lower = task.title.lower()
        if task.type in ("search", "find") or "find" in title_lower or "list" in title_lower:
            tool_name = "calendar.list_events"
        else:
            tool_name = "calendar.create_event"
    elif cap == "search":
        title_lower = task.title.lower()
        if "time" in title_lower or "slot" in title_lower or "calendar" in title_lower or "availab" in title_lower or "saturday" in str(task.inputs).lower():
            tool_name = "calendar.list_events"
    elif cap in ("document", "email") and (task.type in ("draft", "create") or "draft" in task.title.lower()):
        tool_name = "gmail.create_draft"
    elif cap in ("communication", "email") and (task.type in ("communicate", "send") or "send" in task.title.lower()):
        tool_name = "gmail.send_draft"

    if tool_name:
        return tool_name

    # Check if a custom tool was registered matching capability or task key
    if task.capability and get_tool(task.capability):
        return task.capability
    if get_tool(task.key):
        return task.key

    return None


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


def _run_verification(db: Session, mission: Mission, task: Task) -> Mission:
    """Criteria come from the dependencies' results, including each tool's own re-read.
    A step the user rejected stays an *open* criterion: it does not fail the mission."""
    append_event(db, mission, EventType.VERIFICATION_STARTED, "verification", {})
    criteria: list[dict[str, Any]] = []
    for d in task.dependencies:
        dep = d.depends_on
        label = dep.criterion or dep.title
        if dep.status == TaskStatus.SKIPPED:
            criteria.append({"task": dep.key, "label": label, "passed": False, "open": True, "detail": "Skipped: not approved or not allowed."})
            continue
        v = (dep.output or {}).get("verification") or {}
        passed = dep.status == TaskStatus.DONE and bool(dep.output) and (v.get("verified") is not False or bool(v.get("simulated")))
        item = {"task": dep.key, "label": label, "passed": passed}
        if v.get("simulated"):
            item["simulated"] = True
        if v.get("detail"):
            item["detail"] = v["detail"]
        criteria.append(item)

    failed = [c for c in criteria if not c["passed"] and not c.get("open")]
    open_items = [c for c in criteria if c.get("open")]
    verified = not failed
    task.status = TaskStatus.DONE if verified else TaskStatus.FAILED
    task.finished_at = utcnow()
    task.output = {"verified": verified, "criteria": criteria}
    append_event(db, mission, EventType.VERIFICATION_COMPLETED, "verification", {"criteria": criteria, "verified": verified})
    if verified:
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = utcnow()
        summary = "Mission completed and verified."
        if open_items:
            summary = f"Mission completed; {len(open_items)} criterion(s) left open because a step was not approved."
        append_event(db, mission, EventType.MISSION_COMPLETED, "planner", {"status": "completed", "summary": summary})
    else:
        mission.status = MissionStatus.FAILED
        append_event(db, mission, EventType.MISSION_FAILED, "planner", {"status": "failed", "summary": "Verification failed."})
    db.commit()
    return mission


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
        if not is_verification and any(d.depends_on.status == TaskStatus.SKIPPED for d in task.dependencies):
            _skip(db, mission, task, "skipped_dependency_skipped", "A step this depends on was skipped.")
            continue

        # Resolve inputs from dependencies
        resolved_inputs = resolve_inputs(task.inputs or {}, completed_outputs)
        check_no_secrets_or_tokens(resolved_inputs)
        task.inputs = resolved_inputs

        if is_verification:
            return _run_verification(db, mission, task)

        tool_name = find_tool_name_for_task(task)
        if tool_name is None:
            # No real tool exists for this step: run it as a clearly marked simulation.
            task.status = TaskStatus.DONE
            task.started_at = task.started_at or utcnow()
            task.finished_at = utcnow()
            task.output = {"simulated": True, "title": task.title}
            completed_outputs[task.key] = task.output
            append_event(db, mission, EventType.TASK_STARTED, task.agent, {"task_key": task.key, "simulated": True})
            append_event(
                db, mission, EventType.TOOL_COMPLETED, task.agent,
                {"task_key": task.key, "tool": None, "status": "success", "simulated": True, "output": task.output, "evidence": []},
            )
            db.commit()
            continue
        real = google_live
        if not real:
            # Demo Mode: we use the simulated version if available
            tool = get_simulated_tool(tool_name) or get_tool(tool_name)
            if not tool:
                task.status = TaskStatus.DONE
                task.started_at = task.started_at or utcnow()
                task.finished_at = utcnow()
                task.output = {"simulated": True, "title": task.title}
                completed_outputs[task.key] = task.output
                append_event(db, mission, EventType.TASK_STARTED, task.agent, {"task_key": task.key, "simulated": True})
                append_event(
                    db, mission, EventType.TOOL_COMPLETED, task.agent,
                    {"task_key": task.key, "tool": None, "status": "success", "simulated": True, "output": task.output, "evidence": []},
                )
                db.commit()
                continue
        else:
            # Live Mode: MUST NOT silently simulate. Use real tool or fail correctly.
            resolution = resolve(tool_name, db, user)
            if not resolution.available:
                reason = resolution.reason or "tool_unavailable"
                pause = reason == "not_connected"
                return _fail(db, mission, task, reason, "Could not use the tool. Connect the required integration and try again." if pause else "The required tool is unavailable.", pause=pause)
            tool = resolution.tool
            if not tool:
                return _fail(db, mission, task, "tool_unavailable", "Tool not found.")

        # Apply the user's preferences (#18) before approval, so the approval shows
        # exactly what will run. Unknown contact groups are asked about, never guessed.
        try:
            resolved_inputs, applied_prefs = apply_preferences(tool.name, resolved_inputs, prefs)
        except UnknownGroupError as err:
            task.status = TaskStatus.FAILED
            task.finished_at = utcnow()
            mission.status = MissionStatus.PAUSED
            append_event(
                db, mission, EventType.TASK_FAILED, task.agent,
                {"task_key": task.key, "error_class": "needs_clarification", "message": err.question, "group": err.group},
            )
            db.commit()
            return mission
        task.inputs = resolved_inputs

        # 1. Existing Approval Gateway -> update inputs before policy check
        existing_approval = db.scalar(select(Approval).where(Approval.task_id == task.id))
        if existing_approval:
            if existing_approval.status == "pending":
                task.status = TaskStatus.AWAITING
                mission.status = MissionStatus.AWAITING_APPROVAL
                db.commit()
                return mission
            elif existing_approval.status == "rejected":
                _skip(db, mission, task, "skipped_due_to_rejection", "You rejected this action, so it was not performed.")
                continue
            elif existing_approval.status in ("approved", "edited"):
                if existing_approval.payload_json:
                    resolved_inputs.update(existing_approval.payload_json)
                    task.inputs = resolved_inputs
            else:
                _skip(db, mission, task, "skipped_approval_closed", f"The approval was {existing_approval.status}.")
                continue

        # 2. Policy Engine: one decision point before every tool call (#42)
        decision = decide(db, user, real, tool, task.gated, resolved_inputs)
        if not decision.permitted:
            refusal = decision.reason or "Permission denied."
            error_class = decision.error_class or "permission_denied"
            append_event(db, mission, EventType.TASK_FAILED, task.agent, {"task_key": task.key, "error_class": error_class, "message": refusal})
            _skip(db, mission, task, "skipped_permission_denied", refusal)
            continue

        # 3. New Approval Gateway
        if decision.requires_approval and not existing_approval:
            approval = Approval(
                mission_id=mission.id,
                task_id=task.id,
                tool_name=tool.name,
                risk=str(tool.risk),
                category="External action",
                reason=f"Action '{tool.name}' interacts with an external app and requires approval.",
                payload_json=redact_dict(resolved_inputs),
                original_payload_json=redact_dict(resolved_inputs),
                status="pending",
            )
            db.add(approval)
            task.status = TaskStatus.AWAITING
            mission.status = MissionStatus.AWAITING_APPROVAL
            db.flush()
            append_event(
                db, mission, EventType.APPROVAL_REQUESTED, "approval",
                {
                    "approval_id": approval.id,
                    "task_key": task.key,
                    "tool": tool.name,
                    "risk": str(tool.risk),
                    "category": approval.category,
                    "reason": approval.reason,
                    "payload": redact_dict(resolved_inputs),
                    "applied_preferences": applied_prefs,
                    "simulated": not real,
                },
            )
            db.commit()
            return mission

        if _tool_calls(db, mission) >= MAX_TOOL_CALLS_PER_MISSION:
            return _fail(db, mission, task, "budget_exceeded", f"This mission used its budget of {MAX_TOOL_CALLS_PER_MISSION} tool calls.")

        # Execute Tool
        task.status = TaskStatus.RUNNING
        task.started_at = utcnow()
        append_event(db, mission, EventType.TASK_STARTED, task.agent, {"task_key": task.key, "simulated": not real})
        append_event(
            db, mission, EventType.TOOL_CALLED, task.agent,
            {"task_key": task.key, "tool": tool.name, "risk": str(tool.risk), "applied_preferences": applied_prefs},
        )

        # Ensure tool exists in Tool table
        if db.get(ToolModel, tool.name) is None:
            db.add(ToolModel(name=tool.name, capability=tool.capability, risk=str(tool.risk), description=tool.description))
            db.flush()

        ctx = ToolContext(
            user_id=user.id,
            mission_id=mission.id,
            task_id=task.id,
            db=db,
            idempotency_key=f"{mission.id}:{task.key}",
            preferences=prefs.as_client(),
            google=google_client if tool.integration == "google" else None,
        )

        result, message, te = None, "Tool execution failed", None
        for attempt in range(1, MAX_RETRIES + 2):
            te = ToolExecution(
                mission_id=mission.id, task_id=task.id, tool_name=tool.name, risk=str(tool.risk),
                input_json=redact_dict(resolved_inputs), status="running", attempt=attempt,
            )
            db.add(te)
            db.flush()
            try:
                result = tool.execute(ctx, resolved_inputs)
            except Exception as exc:  # classified; never leaks details or tokens
                result = ToolResult(status="failed", tool=tool.name, error_class=tool.classify(exc))
                message = getattr(exc, "message", None) or "The tool failed unexpectedly."
            te.finished_at = utcnow()
            if result.status == "success":
                break
            te.status, te.error_class = "failed", result.error_class
            if (
                result.error_class in TRANSIENT_ERRORS
                and attempt <= MAX_RETRIES
                and _tool_calls(db, mission) < MAX_TOOL_CALLS_PER_MISSION
                and time.monotonic() < deadline
            ):
                append_event(
                    db, mission, EventType.RECOVERY_STARTED, "recovery",
                    {"task_key": task.key, "strategy": "retry", "attempt": attempt + 1, "error_class": result.error_class},
                )
                db.commit()
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
                continue
            break

        if result.status != "success":
            # Lost access is fixable by the user (reconnect), so the mission pauses.
            return _fail(db, mission, task, result.error_class or "execution_failed", message,
                         pause=result.error_class == "authentication_failed")

        # Independent verification: re-read the result from the app itself.
        try:
            verification = tool.verify(ctx, result)
        except Exception as exc:
            verification = {"verified": False, "error_class": tool.classify(exc), "detail": getattr(exc, "message", None) or "Could not re-read the result."}
        result.verification = verification

        task.status = TaskStatus.DONE
        task.finished_at = utcnow()
        task.output = {**result.output, "verification": verification}
        completed_outputs[task.key] = task.output
        te.status = "success"
        te.output_json = redact_dict(result.output)

        for ev in result.evidence:
            db.add(Evidence(
                mission_id=mission.id,
                task_id=task.id,
                tool_execution_id=te.id,
                type=ev.get("type", "proof"),
                source=ev.get("source", tool.name),
                reference_id=ev.get("reference_id"),
                label=ev.get("label", ""),
                url=ev.get("url"),
            ))

        append_event(
            db, mission, EventType.TOOL_COMPLETED, task.agent,
            {
                "task_key": task.key,
                "tool": tool.name,
                "status": "success",
                "simulated": result.simulated,
                "output": redact_dict(result.output),
                "evidence": result.evidence,
                "verification": verification,
            },
        )
        db.commit()

    # Every task is done, or skipped by a user decision.
    if all(t.status in (TaskStatus.DONE, TaskStatus.SKIPPED) for t in mission.tasks):
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = utcnow()
        skipped = sum(1 for t in mission.tasks if t.status == TaskStatus.SKIPPED)
        summary = "All tasks completed." if not skipped else f"Completed; {skipped} step(s) skipped by your decisions."
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
