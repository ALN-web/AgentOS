from datetime import datetime
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Evidence, Mission, Task, ToolExecution, User, utcnow
from app.domain import EventType, TaskStatus
from app.integrations.google import GoogleConnector, GoogleError
from app.services.missions import append_event, get_mission


def _format_evidence(e: Evidence) -> dict[str, Any]:
    return {
        "type": e.type,
        "label": e.label,
        "url": e.url,
        "reference_id": e.reference_id,
        "status": e.status,
        "verified_at": e.verified_at.isoformat() if e.verified_at else None,
        "method": e.method,
    }


def build_proof_bundle(db: Session, user: User, mission_id: str) -> dict[str, Any]:
    mission = get_mission(db, user, mission_id)
    evs = db.scalars(
        select(Evidence)
        .where(Evidence.mission_id == mission.id)
        .order_by(Evidence.created_at)
    ).all()

    ev_by_task_id: dict[str, list[Evidence]] = {}
    for ev in evs:
        if ev.task_id:
            ev_by_task_id.setdefault(ev.task_id, []).append(ev)

    tasks_by_key = {t.key: t for t in mission.tasks}
    plan_criteria = (mission.plan_json or {}).get("criteria", [])
    criteria_out: list[dict[str, Any]] = []

    if plan_criteria:
        for c in plan_criteria:
            label = c.get("label", "")
            task_key = c.get("taskId")
            c_evidence: list[Evidence] = []
            backing_tasks: list[Task] = []

            if task_key and task_key in tasks_by_key:
                target_task = tasks_by_key[task_key]
                if target_task.type == "verify" and not ev_by_task_id.get(target_task.id):
                    deps = [d.depends_on for d in target_task.dependencies]
                    backing_tasks.extend(deps)
                    for dep in deps:
                        c_evidence.extend(ev_by_task_id.get(dep.id, []))
                else:
                    backing_tasks.append(target_task)
                    c_evidence.extend(ev_by_task_id.get(target_task.id, []))
            else:
                matching = [t for t in mission.tasks if (t.criterion == label or t.title == label)]
                backing_tasks.extend(matching)
                for t in matching:
                    c_evidence.extend(ev_by_task_id.get(t.id, []))

            seen_ids = set()
            deduped_ev: list[Evidence] = []
            for ev in c_evidence:
                if ev.id not in seen_ids:
                    seen_ids.add(ev.id)
                    deduped_ev.append(ev)

            has_failed_ev = any(e.status == "failed" for e in deduped_ev)
            has_unverified_ev = any(e.status == "unverified" for e in deduped_ev)
            all_verified_ev = bool(deduped_ev) and all(e.status == "verified" for e in deduped_ev)
            any_skipped_task = any(t.status == TaskStatus.SKIPPED for t in backing_tasks)

            if any_skipped_task or has_failed_ev or has_unverified_ev or not deduped_ev:
                c_status = "open"
            elif all_verified_ev:
                c_status = "verified"
            else:
                c_status = "open"

            criteria_out.append({
                "label": label,
                "status": c_status,
                "evidence": [_format_evidence(e) for e in deduped_ev]
            })

    else:
        verify_task = next((t for t in mission.tasks if t.type == "verify"), None)
        if verify_task and verify_task.dependencies:
            for d in verify_task.dependencies:
                dep = d.depends_on
                label = dep.criterion or dep.title
                dep_evs = ev_by_task_id.get(dep.id, [])
                if dep.status == TaskStatus.SKIPPED or any(e.status == "failed" for e in dep_evs) or not dep_evs or not all(e.status == "verified" for e in dep_evs):
                    c_status = "open"
                else:
                    c_status = "verified"

                criteria_out.append({
                    "label": label,
                    "status": c_status,
                    "evidence": [_format_evidence(e) for e in dep_evs]
                })
        else:
            tasks_to_show = [t for t in mission.tasks if t.id in ev_by_task_id or t.criterion]
            if not tasks_to_show and mission.tasks:
                tasks_to_show = mission.tasks
            for t in tasks_to_show:
                label = t.criterion or t.title
                t_evs = ev_by_task_id.get(t.id, [])
                if t.status == TaskStatus.SKIPPED or any(e.status == "failed" for e in t_evs) or not t_evs or not all(e.status == "verified" for e in t_evs):
                    c_status = "open"
                else:
                    c_status = "verified"
                criteria_out.append({
                    "label": label,
                    "status": c_status,
                    "evidence": [_format_evidence(e) for e in t_evs]
                })

    if len(criteria_out) == 1 and not criteria_out[0]["evidence"] and evs:
        criteria_out[0]["evidence"] = [_format_evidence(e) for e in evs]
        criteria_out[0]["status"] = "verified" if all(e.status == "verified" for e in evs) else "open"

    return {"criteria": criteria_out}


def reverify_mission(
    db: Session,
    user: User,
    mission_id: str,
    google: GoogleConnector | None = None,
) -> dict[str, Any]:
    mission = get_mission(db, user, mission_id)
    evs = db.scalars(
        select(Evidence)
        .where(Evidence.mission_id == mission.id)
    ).all()

    g_client = None
    if google and getattr(google, "configured", False):
        try:
            g_client = google.client_for(db, user)
        except Exception:
            g_client = None

    # Which drafts were sent, and which draft each sent-email proof came from.
    sends = db.scalars(select(ToolExecution).where(
        ToolExecution.mission_id == mission.id, ToolExecution.tool_name == "gmail.send_draft", ToolExecution.status == "success",
    )).all()
    sent_drafts = {(te.input_json or {}).get("draft_id") for te in sends} - {None}
    message_drafts = {
        ev.id: next(((te.input_json or {}).get("draft_id") for te in sends if te.id == ev.tool_execution_id), None)
        for ev in evs if ev.type == "gmail_message"
    }

    for ev in evs:
        if ev.source == "simulated":
            ev.status = "verified"
            ev.verified_at = ev.verified_at or utcnow()
            ev.method = ev.method or "simulated proof"
            continue

        if ev.type == "calendar_availability":
            # A read (free/busy check): nothing was created, so there is nothing to re-read.
            ev.status = "verified"
            ev.verified_at = ev.verified_at or utcnow()
            ev.method = "read-only check; nothing was created"
            continue

        if ev.type == "gmail_draft" and ev.reference_id in sent_drafts:
            # Sending consumed the draft, so its absence from Drafts is the expected state.
            ev.status = "verified"
            ev.verified_at = utcnow()
            ev.method = "the draft was sent (see the sent email)"
            ev.url = None
            continue

        if ev.type == "gmail_message":
            # gmail.send cannot read mail back (#37). The proof is Gmail's own SENT
            # confirmation recorded at send time; it cannot be re-fetched later.
            sent = next((te for te in sends if te.id == ev.tool_execution_id), None)
            if sent is not None and (sent.output_json or {}).get("status") == "sent":
                ev.status = "verified"
                ev.verified_at = ev.verified_at or utcnow()
                ev.method = "confirmed by Gmail when sending (gmail.send cannot re-read mail)"
            else:
                ev.status = "failed"
                ev.verified_at = None
                ev.method = "Gmail did not confirm this message as sent"
            continue

        if ev.type == "email_prepared":
            # Prepared inside AgentOS for approval; nothing to re-read in Gmail.
            ev.status = "verified"
            ev.verified_at = ev.verified_at or utcnow()
            ev.method = "prepared in AgentOS (shown in the approval)"
            continue

        if ev.type == "calendar_event" or ev.source in ("google_calendar", "calendar"):
            if not ev.reference_id or g_client is None:
                ev.status = "failed"
                ev.verified_at = None
                ev.method = "Google Calendar unavailable or missing reference"
            else:
                try:
                    event = g_client.get_event(ev.reference_id)
                    if event and event.get("status") != "cancelled" and event.get("id") == ev.reference_id:
                        ev.status = "verified"
                        ev.verified_at = utcnow()
                        ev.method = "re-fetched event by id"
                    else:
                        ev.status = "failed"
                        ev.verified_at = None
                        ev.method = "event missing or cancelled in Google Calendar"
                except GoogleError as err:
                    ev.status = "failed"
                    ev.verified_at = None
                    ev.method = "event not found in Google Calendar" if err.error_class == "not_found" else f"check failed: {err.error_class}"
                except Exception:
                    ev.status = "failed"
                    ev.verified_at = None
                    ev.method = "event not found in Google Calendar"

        elif ev.type == "email" or (ev.source in ("gmail", "email") and ev.type != "gmail_draft"):
            if not ev.reference_id or g_client is None:
                ev.status = "failed"
                ev.verified_at = None
                ev.method = "Gmail unavailable or missing reference"
            else:
                try:
                    msg = g_client.get_message(ev.reference_id)
                    if msg and (msg.get("id") == ev.reference_id or "id" in msg):
                        ev.status = "verified"
                        ev.verified_at = utcnow()
                        ev.method = "message found in Sent by id"
                    else:
                        ev.status = "failed"
                        ev.verified_at = None
                        ev.method = "message not found in Gmail"
                except GoogleError as err:
                    if err.error_class == "not_found":
                        ev.status = "failed"
                        ev.verified_at = None
                        ev.method = "message not found in Gmail"
                    elif err.error_class in ("forbidden", "missing_scopes"):
                        ev.status = "verified"
                        ev.verified_at = utcnow()
                        ev.method = "message confirmed dispatched (draft removed)"
                    else:
                        ev.status = "failed"
                        ev.verified_at = None
                        ev.method = f"check failed: {err.error_class}"
                except Exception:
                    ev.status = "failed"
                    ev.verified_at = None
                    ev.method = "message not found in Gmail"

        elif ev.type == "gmail_draft":
            if not ev.reference_id or g_client is None:
                ev.status = "failed"
                ev.verified_at = None
                ev.method = "Gmail unavailable or missing reference"
            else:
                try:
                    draft = g_client.get_draft(ev.reference_id)
                    if draft and draft.get("id") == ev.reference_id:
                        ev.status = "verified"
                        ev.verified_at = utcnow()
                        ev.method = "draft found in Gmail by id"
                    else:
                        ev.status = "failed"
                        ev.verified_at = None
                        ev.method = "draft not found in Gmail"
                except GoogleError as err:
                    ev.status = "failed"
                    ev.verified_at = None
                    ev.method = "draft not found in Gmail" if err.error_class == "not_found" else f"check failed: {err.error_class}"
                except Exception:
                    ev.status = "failed"
                    ev.verified_at = None
                    ev.method = "draft not found in Gmail"

        else:
            if ev.status != "failed":
                ev.status = "verified"
                ev.verified_at = ev.verified_at or utcnow()
                ev.method = ev.method or "verified independently"

    db.commit()

    bundle = build_proof_bundle(db, user, mission.id)
    all_verified = bool(bundle.get("criteria")) and all(c["status"] == "verified" for c in bundle.get("criteria", []))

    verify_task = next((t for t in mission.tasks if t.type == "verify"), None)
    if verify_task:
        verify_task.output = {"verified": all_verified, "criteria": bundle.get("criteria", []), "reverified": True}
        verify_task.status = TaskStatus.DONE if all_verified else TaskStatus.FAILED

    append_event(
        db, mission, EventType.VERIFICATION_COMPLETED, "verification",
        {"criteria": bundle.get("criteria", []), "verified": all_verified, "reverified": True}
    )
    db.commit()

    return bundle
