"""Live mission execution runner with cross-app data passing and idempotency."""

import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
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
from app.schemas.plan import check_no_secrets_or_tokens, redact_dict
from app.services.missions import append_event, get_mission
from app.tools.base import Tool, ToolContext, ToolResult
from app.tools.google import (
    CalendarCreateEventTool,
    CalendarListEventsTool,
    GmailCreateDraftTool,
    GmailSendDraftTool,
)
from app.tools.registry import get_tool

DEFAULT_TOOLS: dict[str, Tool] = {
    "calendar.list_events": CalendarListEventsTool(),
    "calendar.create_event": CalendarCreateEventTool(),
    "gmail.create_draft": GmailCreateDraftTool(),
    "gmail.send_draft": GmailSendDraftTool(),
}


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


def find_tool_for_task(task: Task) -> Tool | None:
    """Select the appropriate tool for a task based on registry and defaults."""
    # Explicit tool in task inputs or plan
    if task.inputs and isinstance(task.inputs, dict) and "tool" in task.inputs:
        tool_from_input = get_tool(task.inputs["tool"]) or DEFAULT_TOOLS.get(task.inputs["tool"])
        if tool_from_input:
            return tool_from_input

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
        registered = get_tool(tool_name)
        if registered:
            return registered
        if tool_name in DEFAULT_TOOLS:
            return DEFAULT_TOOLS[tool_name]

    # Check if a custom tool was registered matching capability or task key
    if task.capability and get_tool(task.capability):
        return get_tool(task.capability)
    if get_tool(task.key):
        return get_tool(task.key)

    return None


def run_mission(db: Session, user: User, mission_id: str) -> Mission:
    """Execute or resume a mission task by task, respecting approvals and idempotency."""
    mission = get_mission(db, user, mission_id)

    if mission.status == MissionStatus.COMPLETED:
        return mission

    if mission.status == MissionStatus.PLANNED:
        mission.status = MissionStatus.RUNNING
        mission.started_at = utcnow()
        append_event(db, mission, EventType.MISSION_STARTED, "planner", {"status": "running"})
        db.commit()

    # Collect outputs from already completed tasks
    completed_outputs: dict[str, dict[str, Any]] = {
        t.key: (t.output or {}) for t in mission.tasks if t.status == TaskStatus.DONE
    }

    for task in mission.tasks:
        # Partial failure / Idempotency: skip tasks already completed
        if task.status == TaskStatus.DONE:
            continue
        if task.status == TaskStatus.SKIPPED:
            continue

        # Resolve inputs from dependencies
        raw_inputs = task.inputs or {}
        resolved_inputs = resolve_inputs(raw_inputs, completed_outputs)
        check_no_secrets_or_tokens(resolved_inputs)
        task.inputs = resolved_inputs

        idempotency_key = f"{mission.id}:{task.key}"

        # Verification step
        if task.type == "verify" or task.capability == "verification":
            append_event(db, mission, EventType.VERIFICATION_STARTED, "verification", {})
            # Verify dependencies
            criteria_results = []
            all_verified = True
            for d in task.dependencies:
                dep_task = d.depends_on
                passed = dep_task.status == TaskStatus.DONE and bool(dep_task.output)
                criteria_results.append({
                    "task": dep_task.key,
                    "label": dep_task.criterion or dep_task.title,
                    "passed": passed,
                })
                if not passed:
                    all_verified = False

            task.status = TaskStatus.DONE if all_verified else TaskStatus.FAILED
            task.finished_at = utcnow()
            task.output = {"verified": all_verified, "criteria": criteria_results}
            append_event(db, mission, EventType.VERIFICATION_COMPLETED, "verification", {"criteria": criteria_results, "verified": all_verified})

            if all_verified:
                mission.status = MissionStatus.COMPLETED
                mission.completed_at = utcnow()
                append_event(db, mission, EventType.MISSION_COMPLETED, "planner", {"status": "completed", "summary": "Mission completed and verified."})
            else:
                mission.status = MissionStatus.FAILED
                append_event(db, mission, EventType.MISSION_FAILED, "planner", {"status": "failed", "summary": "Verification failed."})
            db.commit()
            return mission

        # Normal tool step
        tool = find_tool_for_task(task)
        if tool is None:
            # Fallback simulated step if no real tool is bound
            task.status = TaskStatus.DONE
            task.finished_at = utcnow()
            task.output = {"simulated": True, "title": task.title}
            completed_outputs[task.key] = task.output
            db.commit()
            continue

        # Check Approval Gateway
        needs_approval = task.gated or tool.risk == RiskLevel.HIGH
        if needs_approval:
            existing_approval = db.scalar(select(Approval).where(Approval.task_id == task.id))
            if existing_approval is None:
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
                    },
                )
                db.commit()
                return mission
            elif existing_approval.status == "pending":
                task.status = TaskStatus.AWAITING
                mission.status = MissionStatus.AWAITING_APPROVAL
                db.commit()
                return mission
            elif existing_approval.status == "rejected":
                task.status = TaskStatus.SKIPPED
                append_event(db, mission, EventType.PLAN_UPDATED, "planner", {"task_key": task.key, "strategy": "skipped_due_to_rejection"})
                continue
            elif existing_approval.status == "edited":
                if existing_approval.payload_json:
                    resolved_inputs.update(existing_approval.payload_json)
                    task.inputs = resolved_inputs

        # Execute Tool
        task.status = TaskStatus.RUNNING
        task.started_at = utcnow()
        append_event(db, mission, EventType.TASK_STARTED, task.agent, {"task_key": task.key, "simulated": False})
        append_event(db, mission, EventType.TOOL_CALLED, task.agent, {"task_key": task.key, "tool": tool.name, "risk": str(tool.risk)})

        # Ensure tool exists in Tool table
        db_tool = db.get(ToolModel, tool.name)
        if db_tool is None:
            db.add(ToolModel(name=tool.name, capability=tool.capability, risk=str(tool.risk), description=tool.description))
            db.flush()

        ctx = ToolContext(
            user_id=user.id,
            mission_id=mission.id,
            task_id=task.id,
            db=db,
            idempotency_key=idempotency_key,
        )

        result = tool.execute(ctx, resolved_inputs)

        if result.status == "success":
            task.status = TaskStatus.DONE
            task.finished_at = utcnow()
            task.output = result.output
            completed_outputs[task.key] = result.output

            # Store ToolExecution record
            te = ToolExecution(
                mission_id=mission.id,
                task_id=task.id,
                tool_name=tool.name,
                risk=str(tool.risk),
                input_json=redact_dict(resolved_inputs),
                output_json=redact_dict(result.output),
                status="success",
            )
            db.add(te)
            db.flush()

            # Store Evidence
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

            # TOOL_COMPLETED.payload.output (redacted) is included
            append_event(
                db, mission, EventType.TOOL_COMPLETED, task.agent,
                {
                    "task_key": task.key,
                    "tool": tool.name,
                    "status": "success",
                    "output": redact_dict(result.output),
                    "evidence": result.evidence,
                },
            )
            db.commit()
        else:
            task.status = TaskStatus.FAILED
            mission.status = MissionStatus.FAILED
            append_event(
                db, mission, EventType.TASK_FAILED, task.agent,
                {
                    "task_key": task.key,
                    "error_class": result.error_class or "execution_failed",
                    "message": "Tool execution failed",
                },
            )
            db.commit()
            return mission

    # If all tasks are completed
    if all(t.status == TaskStatus.DONE for t in mission.tasks):
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = utcnow()
        append_event(db, mission, EventType.MISSION_COMPLETED, "planner", {"status": "completed", "summary": "All tasks completed."})
        db.commit()

    return mission


def handle_approval_decision(
    db: Session,
    user: User,
    approval_id: str,
    decision: str,
    edits: dict[str, Any] | None = None,
) -> Approval:
    """Handle an approval decision (approve, edit, reject). Resumes mission execution on approval."""
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
    now = utcnow()
    approval.decided_at = now
    approval.decided_by = user.id

    if decision == "approve":
        approval.status = "approved"
        append_event(db, mission, EventType.APPROVAL_GRANTED, "approval", {"approval_id": approval.id, "edited": False})
    elif decision == "edit":
        approval.status = "edited"
        if edits:
            check_no_secrets_or_tokens(edits)
            approval.payload_json = edits
        append_event(db, mission, EventType.APPROVAL_GRANTED, "approval", {"approval_id": approval.id, "edited": True})
    elif decision == "reject":
        approval.status = "rejected"
        append_event(db, mission, EventType.APPROVAL_REJECTED, "approval", {"approval_id": approval.id, "edited": False})
    else:
        raise AppError("invalid_decision", f"Invalid decision '{decision}'.", status_code=422)

    db.commit()

    # Automatically resume mission if approved or edited
    if decision in ("approve", "edit"):
        mission.status = MissionStatus.RUNNING
        db.commit()
        run_mission(db, user, mission.id)

    return approval
