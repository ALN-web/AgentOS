"""Google Workspace everyday tools (Calendar and Gmail), #6.

With a connected Google account (`ctx.google`), every tool calls the real API and
`verify` re-reads the result from Google independently. Simulated versions
return a clearly marked simulation: `simulated=True`, and the evidence carries no link.
"""

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field, EmailStr, validator

from app.domain import RiskLevel
from app.integrations.google import GMAIL_SEND, GoogleError, event_id_for
from app.schemas.preferences import Preferences
from app.tools.base import Tool, ToolContext, ToolResult

SIM_START = "2026-10-03T19:00:00Z"
SIM_END = "2026-10-03T21:00:00Z"


def _simulated_evidence(ev: dict[str, Any]) -> list[dict[str, Any]]:
    return [{**ev, "source": "simulated", "label": f"Simulated: {ev['label']}", "url": None}]


def _parse(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise GoogleError("validation_error", f"'{value}' is not a valid date and time.") from None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _event_time(ev: dict, key: str) -> datetime | None:
    t = ev.get(key) or {}
    if t.get("dateTime"):
        return _parse(t["dateTime"])
    if t.get("date"):  # all-day event
        return _parse(f"{t['date']}T00:00:00+00:00")
    return None


def _emails(value: Any) -> list[str]:
    if not value:
        return []
    items = value if isinstance(value, list) else str(value).split(",")
    return [str(e).strip() for e in items if str(e).strip()]


def _prefs(ctx: ToolContext) -> Preferences:
    return Preferences.model_validate(ctx.preferences or {})


class CalendarListEventsTool(Tool):
    name = "calendar.list_events"
    action_id = "calendar.read"
    capability = "calendar"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/calendar.events",)
    description = "List calendar events and find a free slot."
    risk = RiskLevel.LOW
    output_fields = ("events", "free_slots", "count", "start", "end")
    supports_idempotency = True

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        from app.services.preferences import next_free_slot

        prefs = _prefs(ctx)
        length = timedelta(minutes=prefs.meeting_length)
        now = datetime.now(timezone.utc)
        wanted = _parse(args.get("start"))
        horizon_start = min(wanted, now) if wanted else now
        items = ctx.google.list_events(horizon_start.isoformat(), (max(wanted or now, now) + timedelta(days=14)).isoformat())
        busy = [(s, e) for ev in items if ev.get("transparency") != "transparent"
                for s, e in [(_event_time(ev, "start"), _event_time(ev, "end"))] if s and e]

        def clash(s: datetime, e: datetime) -> datetime | None:
            ends = [be for bs, be in busy if bs < e and s < be]
            return max(ends) if ends else None

        if wanted:
            # An explicit time from the goal is kept; we only report whether it is free.
            end = _parse(args.get("end")) or wanted + length
            start, free = wanted, [] if clash(wanted, end) else [wanted.isoformat()]
        else:
            free, cursor, start, end = [], now, None, None
            for _ in range(50):
                s, e = next_free_slot(prefs, cursor)
                blocked_until = clash(s, e)
                if blocked_until:
                    cursor = blocked_until
                    continue
                free.append(s.isoformat())
                if start is None:
                    start, end = s, e
                if len(free) == 3:
                    break
                cursor = e
            if start is None:
                return ToolResult(status="failed", tool=self.name, error_class="no_free_slot",
                                  output={"events": [], "free_slots": [], "count": 0})
        events = [{"summary": ev.get("summary", "(busy)"), "start": (ev.get("start") or {}).get("dateTime") or (ev.get("start") or {}).get("date"),
                   "end": (ev.get("end") or {}).get("dateTime") or (ev.get("end") or {}).get("date")} for ev in items]
        label = f"Checked {len(items)} calendar event(s); " + (f"free at {start.isoformat()}" if free else f"{start.isoformat()} clashes with an existing event")
        return ToolResult(
            status="success", tool=self.name,
            output={"free_slots": free, "start": start.isoformat(), "end": end.isoformat(), "events": events, "count": len(items)},
            evidence=[{"type": "calendar_availability", "source": "google_calendar", "label": label, "reference_id": start.isoformat()}],
        )

class SimulatedCalendarListEventsTool(Tool):
    name = "calendar.list_events"
    action_id = "calendar.read"
    capability = "calendar"
    integration = "google"
    kind = "simulated"
    description = "List calendar events and find a free slot."
    risk = RiskLevel.LOW
    output_fields = ("events", "free_slots", "count", "start", "end")
    supports_idempotency = True

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        start = args.get("start", SIM_START)
        end = args.get("end", SIM_END)
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={"free_slots": [start], "start": start, "end": end, "events": [], "count": 0},
            evidence=_simulated_evidence({"type": "calendar_availability", "label": "Found open slot on Saturday 7:00 PM", "reference_id": "slot_sat_19"}),
        )

class CalendarCreateEventInput(BaseModel):
    summary: str | None = None
    title: str | None = None
    start: str | None = None
    end: str | None = None
    timezone: str | None = None
    description: str | None = None
    location: str | None = None
    attendees: str | list[str] | None = None

    @validator('attendees', pre=True)
    def validate_attendees(cls, v):
        if not v: return v
        items = v if isinstance(v, list) else str(v).split(",")
        for e in items:
            e = e.strip()
            if e and "@" not in e:
                raise ValueError(f"Invalid attendee email: {e}")
        return v

class CalendarCreateEventTool(Tool):
    name = "calendar.create_event"
    capability = "calendar"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/calendar.events",)
    description = "Create a calendar event."
    risk = RiskLevel.HIGH
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "idempotency_key", "hangout_link", "attendees")
    supports_idempotency = True
    input_model = CalendarCreateEventInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        summary = args.get("summary") or args.get("title") or "Birthday dinner for 8"
        event_id = event_id_for(ctx.idempotency_key) if ctx.idempotency_key else f"ag{uuid.uuid4().hex}"

        start = _parse(args.get("start"))
        if start is None:
            raise GoogleError("validation_error", "The event has no start time.")
        end = _parse(args.get("end")) or start + timedelta(minutes=_prefs(ctx).meeting_length)
        tz = args.get("timezone") or _prefs(ctx).timezone
        body: dict[str, Any] = {
            "id": event_id,
            "summary": summary,
            "start": {"dateTime": start.isoformat(), "timeZone": tz},
            "end": {"dateTime": end.isoformat(), "timeZone": tz},
        }
        for key in ("description", "location"):
            if args.get(key):
                body[key] = str(args[key])
        attendees = _emails(args.get("attendees"))
        if attendees:
            body["attendees"] = [{"email": e} for e in attendees]
        ev = ctx.google.create_event(body)
        return ToolResult(
            status="success", tool=self.name,
            output={
                "event_id": ev["id"], "html_link": ev.get("htmlLink", ""),
                "start": (ev.get("start") or {}).get("dateTime", start.isoformat()),
                "end": (ev.get("end") or {}).get("dateTime", end.isoformat()),
                "summary": ev.get("summary", summary), "status": ev.get("status", "confirmed"),
                "idempotency_key": ctx.idempotency_key, "hangout_link": ev.get("hangoutLink"),
                "attendees": [a.get("email") for a in ev.get("attendees", [])],
            },
            evidence=[{"type": "calendar_event", "source": "google_calendar", "label": f"Open '{summary}' in Google Calendar",
                       "url": ev.get("htmlLink"), "reference_id": ev["id"]}],
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        ev = ctx.google.get_event(result.output["event_id"])
        ok = ev.get("status") != "cancelled" and ev.get("id") == result.output["event_id"]
        return {"verified": ok, "detail": "Re-read the event from Google Calendar." if ok else "The event is missing or cancelled.", "method": "re-fetched event by id"}

class SimulatedCalendarCreateEventTool(Tool):
    name = "calendar.create_event"
    capability = "calendar"
    integration = "google"
    kind = "simulated"
    description = "Create a calendar event."
    risk = RiskLevel.HIGH
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "idempotency_key", "hangout_link", "attendees")
    supports_idempotency = True
    input_model = CalendarCreateEventInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        summary = args.get("summary") or args.get("title") or "Birthday dinner for 8"
        event_id = event_id_for(ctx.idempotency_key) if ctx.idempotency_key else f"ag{uuid.uuid4().hex}"

        html_link = f"https://calendar.google.com/calendar/event?eid={event_id}"
        start, end = args.get("start", SIM_START), args.get("end", SIM_END)
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={"event_id": event_id, "html_link": html_link, "start": start, "end": end,
                    "summary": summary, "status": "confirmed", "idempotency_key": ctx.idempotency_key},
            evidence=_simulated_evidence({"type": "calendar_event", "label": f"Created event '{summary}'", "reference_id": event_id}),
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        return {"verified": False, "simulated": True, "detail": "Simulated; nothing to re-read."}


class GmailCreateDraftInput(BaseModel):
    subject: str | None = None
    body_link: str | None = None
    html_link: str | None = None
    event_link: str | None = None
    body: str | None = None
    signature: str | None = None
    to: str | list[str] | None = None

    @validator('to', pre=True)
    def validate_recipients(cls, v):
        if not v: return v
        items = v if isinstance(v, list) else str(v).split(",")
        for e in items:
            e = e.strip()
            if e and "@" not in e:
                raise ValueError(f"Invalid recipient email: {e}")
        return v

def _compose_body(args: dict[str, Any]) -> tuple[str, str]:
    subject = args.get("subject", "Birthday Dinner Invitation")
    event_link = args.get("body_link") or args.get("html_link") or args.get("event_link") or ""
    body = args.get("body")
    if not body:
        body = (
            f"Hi,\n\nYou are invited to the birthday dinner for 8 on Saturday!\n"
            f"Event details & link: {event_link}\n\nHope you can make it!"
        )
    elif event_link and event_link not in body:
        body = f"{body}\n\nEvent link: {event_link}"
    signature = args.get("signature")
    if signature and signature not in body:
        body = f"{body.rstrip()}\n\n{signature}"
    return subject, body


class GmailCreateDraftTool(Tool):
    """Prepares the email inside AgentOS (#37). Nothing is written to Gmail: the text is
    shown in the send step's approval card, and only the approved send reaches Gmail.
    (Gmail drafts need the restricted gmail.compose scope, which unverified apps cannot use
    for other people's accounts.)"""

    name = "gmail.create_draft"
    capability = "document"
    integration = "google"
    kind = "real"
    required_scopes = (GMAIL_SEND,)
    description = "Prepare an email (recipients, subject, body) for approval before it is sent."
    risk = RiskLevel.MEDIUM
    output_fields = ("draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link")
    supports_idempotency = True
    input_model = GmailCreateDraftInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        subject, body = _compose_body(args)
        to = ", ".join(_emails(args.get("to")))
        if not to:
            raise GoogleError("validation_error", "The email has no recipients. Name them, or add a contact group in Settings.")
        draft_id = "prep_" + hashlib.sha256((ctx.idempotency_key or uuid.uuid4().hex).encode()).hexdigest()[:16]
        return ToolResult(
            status="success", tool=self.name,
            output={"draft_id": draft_id, "message_id": None, "thread_id": None,
                    "subject": subject, "body": body, "to": to, "html_link": None},
            evidence=[{"type": "email_prepared", "source": "agentos", "label": f"Email prepared: {subject}",
                       "url": None, "reference_id": draft_id}],
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        ok = bool(result.output.get("to") and result.output.get("body"))
        return {"verified": ok, "detail": "Prepared in AgentOS for your approval; nothing has been sent yet.",
                "method": "prepared locally"}

class SimulatedGmailCreateDraftTool(Tool):
    name = "gmail.create_draft"
    capability = "document"
    integration = "google"
    kind = "simulated"
    description = "Create a Gmail draft with invitation details."
    risk = RiskLevel.MEDIUM
    output_fields = ("draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link")
    supports_idempotency = True
    input_model = GmailCreateDraftInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        subject = args.get("subject", "Birthday Dinner Invitation")
        event_link = args.get("body_link") or args.get("html_link") or args.get("event_link") or ""

        body = args.get("body")
        if not body:
            body = (
                f"Hi,\n\nYou are invited to the birthday dinner for 8 on Saturday!\n"
                f"Event details & link: {event_link}\n\nHope you can make it!"
            )
        elif event_link and event_link not in body:
            body = f"{body}\n\nEvent link: {event_link}"
        signature = args.get("signature")
        if signature and signature not in body:
            body = f"{body.rstrip()}\n\n{signature}"

        to = args.get("to", "guest@example.com")
        draft_id = f"draft_{uuid.uuid4().hex[:12]}"
        message_id = f"msg_{uuid.uuid4().hex[:12]}"
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={"draft_id": draft_id, "message_id": message_id, "thread_id": f"th_{message_id}", "subject": subject,
                    "body": body, "to": to, "html_link": f"https://mail.google.com/mail/#drafts/{draft_id}"},
            evidence=_simulated_evidence({"type": "gmail_draft", "label": f"Draft: {subject}", "reference_id": draft_id}),
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        return {"verified": False, "simulated": True, "detail": "Simulated; nothing to re-read."}


class GmailSendDraftInput(BaseModel):
    draft_id: str | None = None
    message_id: str | None = None
    body: str | None = None
    subject: str | None = None
    to: str | list[str] | None = None

    @validator('to', pre=True)
    def validate_recipients(cls, v):
        if not v: return v
        items = v if isinstance(v, list) else str(v).split(",")
        for e in items:
            e = e.strip()
            if e and "@" not in e:
                raise ValueError(f"Invalid recipient email: {e}")
        return v

def _prepared_email(ctx: ToolContext, draft_id: str | None) -> dict[str, Any]:
    """The email a draft step prepared in this mission (fallback when the plan passed only draft_id)."""
    if not draft_id or ctx.db is None:
        return {}
    from sqlalchemy import select

    from app.db.models import Task

    for out in ctx.db.scalars(select(Task.output).where(Task.mission_id == ctx.mission_id)):
        if isinstance(out, dict) and out.get("draft_id") == draft_id:
            return out
    return {}


class GmailSendDraftTool(Tool):
    """Sends the approved email directly with gmail.send (#37)."""

    name = "gmail.send_draft"
    capability = "communication"
    integration = "google"
    kind = "real"
    required_scopes = (GMAIL_SEND,)
    description = "Send the prepared email (after approval)."
    risk = RiskLevel.HIGH
    output_fields = ("message_id", "thread_id", "status", "sent_at", "body", "subject", "to")
    supports_idempotency = True
    input_model = GmailSendDraftInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        prepared = _prepared_email(ctx, args.get("draft_id"))
        to = ", ".join(_emails(args.get("to") or prepared.get("to")))
        subject = args.get("subject") or prepared.get("subject") or ""
        body = args.get("body") or prepared.get("body") or ""
        if not to:
            raise GoogleError("validation_error", "There is no recipient for this email.")
        if not body:
            raise GoogleError("validation_error", "The email has no text to send.")
        try:
            sent = ctx.google.send_message(to, subject, body)
        except GoogleError as err:
            if err.error_class in ("timeout", "network_error", "service_unavailable"):
                # Gmail may have sent it before the answer was lost: never resend automatically.
                raise GoogleError("send_unconfirmed", "Gmail did not confirm the send. Check your Sent folder before trying again.") from None
            raise
        labels = sent.get("labelIds") or []
        return ToolResult(
            status="success", tool=self.name,
            output={"message_id": sent["id"], "thread_id": sent.get("threadId"), "status": "sent" if "SENT" in labels else "queued",
                    "sent_at": datetime.now(timezone.utc).isoformat(), "body": body, "subject": subject, "to": to,
                    "draft_id": args.get("draft_id")},
            evidence=[{"type": "gmail_message", "source": "gmail", "label": f"Sent to {to}",
                       "url": f"https://mail.google.com/mail/u/0/#all/{sent['id']}", "reference_id": sent["id"]}],
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        ok = result.output.get("status") == "sent"
        return {"verified": ok,
                "detail": "Gmail confirmed the message as SENT." if ok else "Gmail did not label the message as sent.",
                "method": "confirmed by Gmail when sending (gmail.send cannot re-read mail)"}

class SimulatedGmailSendDraftTool(Tool):
    name = "gmail.send_draft"
    capability = "communication"
    integration = "google"
    kind = "simulated"
    description = "Send a prepared Gmail draft."
    risk = RiskLevel.HIGH
    output_fields = ("message_id", "thread_id", "status", "sent_at", "body", "subject", "to")
    supports_idempotency = True
    input_model = GmailSendDraftInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        body, subject, to = args.get("body", ""), args.get("subject", ""), args.get("to", "")
        message_id = args.get("message_id") or args.get("draft_id") or f"msg_{uuid.uuid4().hex[:12]}"
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={"message_id": message_id, "thread_id": f"th_{message_id}", "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat(), "body": body, "subject": subject, "to": to},
            evidence=_simulated_evidence({"type": "gmail_message", "label": "Sent invitation email", "reference_id": message_id}),
        )
    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        return {"verified": False, "simulated": True, "detail": "Simulated; nothing to re-read."}


class CalendarUpdateEventInput(BaseModel):
    event_id: str
    patch: dict[str, Any]

class CalendarUpdateEventTool(Tool):
    name = "calendar.update_event"
    action_id = "calendar.update_event"
    capability = "calendar"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/calendar.events",)
    description = "Update an existing calendar event."
    risk = RiskLevel.HIGH
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "hangout_link", "attendees")
    input_model = CalendarUpdateEventInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        event_id = args.get("event_id")
        patch_args = args.get("patch", {})

        if not patch_args:
            raise GoogleError("validation_error", "Patch cannot be empty.")

        supported_fields = {"summary", "start", "end", "timezone", "location", "description", "attendees"}
        for k in patch_args:
            if k not in supported_fields:
                raise GoogleError("validation_error", f"Unsupported patch field: {k}")

        patch_body = {}
        if "summary" in patch_args:
            patch_body["summary"] = patch_args["summary"]
        if "description" in patch_args:
            patch_body["description"] = str(patch_args["description"])
        if "location" in patch_args:
            patch_body["location"] = str(patch_args["location"])

        start_dt = _parse(patch_args.get("start"))
        end_dt = _parse(patch_args.get("end"))
        tz = patch_args.get("timezone") or _prefs(ctx).timezone

        if start_dt:
            patch_body["start"] = {"dateTime": start_dt.isoformat(), "timeZone": tz}
        if end_dt:
            patch_body["end"] = {"dateTime": end_dt.isoformat(), "timeZone": tz}

        attendees = _emails(patch_args.get("attendees"))
        if attendees:
            patch_body["attendees"] = [{"email": e} for e in attendees]

        ev = ctx.google.update_event(event_id, patch_body)

        return ToolResult(
            status="success", tool=self.name,
            output={
                "event_id": ev["id"], "html_link": ev.get("htmlLink", ""),
                "start": (ev.get("start") or {}).get("dateTime"),
                "end": (ev.get("end") or {}).get("dateTime"),
                "summary": ev.get("summary", ""), "status": ev.get("status", "confirmed"),
                "hangout_link": ev.get("hangoutLink"),
                "attendees": [a.get("email") for a in ev.get("attendees", [])],
                "_patch_body": patch_body,
            },
            evidence=[{"type": "calendar_event", "source": "google_calendar", "label": f"Open '{ev.get('summary', '')}' in Google Calendar",
                       "url": ev.get("htmlLink"), "reference_id": ev["id"]}],
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        ev = ctx.google.get_event(result.output["event_id"])

        if ev.get("status") == "cancelled" or ev.get("id") != result.output["event_id"]:
            return {"verified": False, "detail": "The event is missing or cancelled.", "method": "re-fetched event by id"}

        patch_body = result.output.get("_patch_body", {})

        for k, v in patch_body.items():
            if k in ("start", "end"):
                if ev.get(k, {}).get("dateTime") != v.get("dateTime") or ev.get(k, {}).get("timeZone") != v.get("timeZone"):
                    return {"verified": False, "detail": "Persisted changes did not match.", "method": "re-fetched event by id"}
            elif k == "attendees":
                ev_attendees = {a.get("email") for a in ev.get("attendees", []) if a.get("email")}
                v_attendees = {a.get("email") for a in v if a.get("email")}
                if ev_attendees != v_attendees:
                    return {"verified": False, "detail": "Persisted changes did not match.", "method": "re-fetched event by id"}
            else:
                if ev.get(k) != v:
                    return {"verified": False, "detail": "Persisted changes did not match.", "method": "re-fetched event by id"}

        return {"verified": True, "detail": "Re-read the event and confirmed changes.", "method": "re-fetched event by id"}

class SimulatedCalendarUpdateEventTool(Tool):
    name = "calendar.update_event"
    action_id = "calendar.update_event"
    capability = "calendar"
    integration = "google"
    kind = "simulated"
    description = "Update an existing calendar event."
    risk = RiskLevel.HIGH
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "hangout_link", "attendees")
    input_model = CalendarUpdateEventInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        event_id = args.get("event_id")
        patch = args.get("patch", {})
        summary = patch.get("summary", "Simulated Event")

        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={"event_id": event_id, "start": SIM_START, "end": SIM_END,
                    "summary": summary, "status": "confirmed"},
            evidence=_simulated_evidence({"type": "calendar_event", "label": f"Updated event '{summary}'", "reference_id": event_id}),
        )

class CalendarGetEventInput(BaseModel):
    event_id: str

class CalendarGetEventTool(Tool):
    name = "calendar.get_event"
    capability = "calendar"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/calendar.events",)
    description = "Get an existing calendar event."
    risk = RiskLevel.LOW
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "hangout_link", "attendees")
    input_model = CalendarGetEventInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        event_id = args.get("event_id")
        ev = ctx.google.get_event(event_id)

        return ToolResult(
            status="success", tool=self.name,
            output={
                "event_id": ev["id"], "html_link": ev.get("htmlLink", ""),
                "start": (ev.get("start") or {}).get("dateTime"),
                "end": (ev.get("end") or {}).get("dateTime"),
                "summary": ev.get("summary", ""), "status": ev.get("status", "confirmed"),
                "hangout_link": ev.get("hangoutLink"),
                "attendees": [a.get("email") for a in ev.get("attendees", [])],
            },
            evidence=[{"type": "calendar_event", "source": "google_calendar", "label": f"Open '{ev.get('summary', '')}' in Google Calendar",
                       "url": ev.get("htmlLink"), "reference_id": ev["id"]}],
        )

class SimulatedCalendarGetEventTool(Tool):
    name = "calendar.get_event"
    capability = "calendar"
    integration = "google"
    kind = "simulated"
    description = "Get an existing calendar event."
    risk = RiskLevel.LOW
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "hangout_link", "attendees")
    input_model = CalendarGetEventInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        event_id = args.get("event_id")
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={"event_id": event_id, "start": SIM_START, "end": SIM_END,
                    "summary": "Simulated Event", "status": "confirmed"},
            evidence=_simulated_evidence({"type": "calendar_event", "label": "Found simulated event", "reference_id": event_id}),
        )

GOOGLE_TOOLS: tuple[Tool, ...] = (
    CalendarListEventsTool(),
    SimulatedCalendarListEventsTool(),
    CalendarCreateEventTool(),
    SimulatedCalendarCreateEventTool(),
    CalendarUpdateEventTool(),
    SimulatedCalendarUpdateEventTool(),
    CalendarGetEventTool(),
    SimulatedCalendarGetEventTool(),
    GmailCreateDraftTool(),
    SimulatedGmailCreateDraftTool(),
    GmailSendDraftTool(),
    SimulatedGmailSendDraftTool(),
)
