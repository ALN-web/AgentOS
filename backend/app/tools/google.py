"""Google Workspace everyday tools (Calendar and Gmail)."""

import uuid
from typing import Any

from app.domain import RiskLevel
from app.tools.base import Tool, ToolContext, ToolResult


class CalendarListEventsTool(Tool):
    name = "calendar.list_events"
    capability = "calendar"
    description = "List calendar events and check availability."
    risk = RiskLevel.LOW
    output_fields = ("events", "free_slots", "count", "start", "end")
    supports_idempotency = True

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        start = args.get("start", "2026-10-03T19:00:00Z")
        end = args.get("end", "2026-10-03T21:00:00Z")
        return ToolResult(
            status="success",
            tool=self.name,
            output={
                "free_slots": [start],
                "start": start,
                "end": end,
                "events": [],
                "count": 0,
            },
            evidence=[{
                "type": "calendar_availability",
                "source": "google_calendar",
                "label": "Found open slot on Saturday 7:00 PM",
                "reference_id": "slot_sat_19",
            }],
        )


class CalendarCreateEventTool(Tool):
    name = "calendar.create_event"
    capability = "calendar"
    description = "Create a calendar event."
    risk = RiskLevel.HIGH
    output_fields = ("event_id", "html_link", "start", "end", "summary", "status", "idempotency_key", "hangout_link", "attendees")
    supports_idempotency = True

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        if ctx.idempotency_key:
            event_id = f"evt_{abs(hash(ctx.idempotency_key)):x}"
        else:
            event_id = f"evt_{uuid.uuid4().hex[:12]}"
        html_link = f"https://calendar.google.com/calendar/event?eid={event_id}"
        summary = args.get("summary") or args.get("title") or "Birthday dinner for 8"
        start = args.get("start", "2026-10-03T19:00:00Z")
        end = args.get("end", "2026-10-03T21:00:00Z")
        return ToolResult(
            status="success",
            tool=self.name,
            output={
                "event_id": event_id,
                "html_link": html_link,
                "start": start,
                "end": end,
                "summary": summary,
                "status": "confirmed",
                "idempotency_key": ctx.idempotency_key,
            },
            evidence=[{
                "type": "calendar_event",
                "source": "google_calendar",
                "label": f"Created event '{summary}'",
                "url": html_link,
                "reference_id": event_id,
            }],
        )


class GmailCreateDraftTool(Tool):
    name = "gmail.create_draft"
    capability = "document"
    description = "Create a Gmail draft with invitation details."
    risk = RiskLevel.MEDIUM
    output_fields = ("draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link")
    supports_idempotency = True

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        draft_id = f"draft_{uuid.uuid4().hex[:12]}"
        message_id = f"msg_{uuid.uuid4().hex[:12]}"
        subject = args.get("subject", "Birthday Dinner Invitation")
        to = args.get("to", "guest@example.com")
        event_link = args.get("body_link") or args.get("html_link") or ""

        body = args.get("body")
        if not body:
            body = (
                f"Hi,\n\nYou are invited to the birthday dinner for 8 on Saturday!\n"
                f"Event details & link: {event_link}\n\nHope you can make it!"
            )
        elif event_link and event_link not in body:
            body = f"{body}\n\nEvent link: {event_link}"

        html_link = f"https://mail.google.com/mail/#drafts/{draft_id}"
        return ToolResult(
            status="success",
            tool=self.name,
            output={
                "draft_id": draft_id,
                "message_id": message_id,
                "thread_id": f"th_{message_id}",
                "subject": subject,
                "body": body,
                "to": to,
                "html_link": html_link,
            },
            evidence=[{
                "type": "gmail_draft",
                "source": "gmail",
                "label": f"Draft: {subject}",
                "url": html_link,
                "reference_id": draft_id,
            }],
        )


class GmailSendDraftTool(Tool):
    name = "gmail.send_draft"
    capability = "communication"
    description = "Send a prepared Gmail draft."
    risk = RiskLevel.HIGH
    output_fields = ("message_id", "thread_id", "status", "sent_at", "body", "subject", "to")
    supports_idempotency = True

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        message_id = args.get("message_id") or args.get("draft_id") or f"msg_{uuid.uuid4().hex[:12]}"
        body = args.get("body", "")
        subject = args.get("subject", "")
        to = args.get("to", "")
        return ToolResult(
            status="success",
            tool=self.name,
            output={
                "message_id": message_id,
                "thread_id": f"th_{message_id}",
                "status": "sent",
                "sent_at": "2026-09-29T20:00:00Z",
                "body": body,
                "subject": subject,
                "to": to,
            },
            evidence=[{
                "type": "gmail_message",
                "source": "gmail",
                "label": "Sent invitation email",
                "url": f"https://mail.google.com/mail/#all/{message_id}",
                "reference_id": message_id,
            }],
        )
