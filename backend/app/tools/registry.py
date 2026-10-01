"""Tool registry: which real tools exist in this build.

Priority 2 (#6) and Priority 5 (#12) register real tools here.
"""

from dataclasses import dataclass
from typing import Union

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.models import Integration, User
from app.tools.base import Tool

@dataclass
class ToolResolution:
    tool: Tool | None
    available: bool
    reason: str | None = None

_REGISTERED_REAL: dict[str, Tool] = {}
_REGISTERED_SIMULATED: dict[str, Tool] = {}

KNOWN_TOOL_OUTPUT_FIELDS: dict[str, set[str]] = {
    "calendar.list_events": {"events", "free_slots", "count", "start", "end"},
    "calendar.create_event": {"event_id", "html_link", "start", "end", "summary", "status", "idempotency_key", "hangout_link", "attendees"},
    "calendar.update_event": {"event_id", "html_link", "start", "end", "summary", "status", "hangout_link", "attendees"},
    "calendar.get_event": {"event_id", "html_link", "start", "end", "summary", "status", "hangout_link", "attendees"},
    "gmail.create_draft": {"draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link"},
    "gmail.send_draft": {"message_id", "thread_id", "status", "sent_at", "body", "subject", "to"},
    "drive.create_document": {"file_id", "html_link", "title", "mime_type"},
    "drive.get_file": {"file_id", "html_link", "title", "mime_type", "trashed"},
    "forms.create_form": {"form_id", "responder_url", "edit_url", "title", "question_count"},
    "forms.get_form": {"form_id", "title", "question_count", "responder_url"},
    "web.search": {"results", "query", "snippets", "urls"},
    "browser.navigate": {"url", "title", "content", "status"},
}

KNOWN_CAPABILITY_OUTPUT_FIELDS: dict[str, set[str]] = {
    "calendar": {"events", "free_slots", "count", "start", "end", "event_id", "html_link", "summary", "status", "idempotency_key", "hangout_link", "attendees"},
    "email": {"draft_id", "message_id", "thread_id", "subject", "body", "to", "status", "sent_at", "html_link"},
    "document": {"draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link", "content", "title", "file_id", "mime_type"},
    "communication": {"message_id", "thread_id", "status", "sent_at", "body", "subject", "to"},
    "reminders": {"event_id", "html_link", "start", "end", "summary", "status"},
    "search": {"results", "query", "snippets", "urls", "start", "end", "free_slots", "slots"},
    "research": {"results", "query", "snippets", "urls", "data", "start", "end", "file_id", "html_link", "title", "mime_type", "trashed"},
    "browser": {"url", "title", "content", "status"},
    "verification": {"verified", "criteria", "summary", "passed", "evidence"},
    "planning": {"plan", "steps", "objective"},
    "analysis": {"summary", "findings", "analysis"},
    "submission": {"submission_id", "status", "url"},
    "purchasing": {"confirmation_id", "amount", "status", "reference"},
    "monitoring": {"status", "responses", "count", "items"},
    "recovery": {"recovered", "action", "strategy"},
    "approval": {"decision", "approved", "notes"},
}


def register_tool(tool: Union[str, Tool]) -> None:
    if isinstance(tool, Tool):
        if getattr(tool, "kind", "real") == "simulated":
            _REGISTERED_SIMULATED[tool.name] = tool
        else:
            _REGISTERED_REAL[tool.name] = tool
    else:
        # Register a string token (like an action_id) so it shows up in registered_tools()
        _REGISTERED_REAL[str(tool)] = None # type: ignore


def unregister_tool(name: str) -> None:
    _REGISTERED_REAL.pop(name, None)
    _REGISTERED_SIMULATED.pop(name, None)


def registered_tools() -> frozenset[str]:
    return frozenset(_REGISTERED_REAL.keys())


def get_tool(name: str) -> Tool | None:
    return _REGISTERED_REAL.get(name) or _REGISTERED_SIMULATED.get(name)


def get_simulated_tool(name: str) -> Tool | None:
    return _REGISTERED_SIMULATED.get(name)


def get_all_tools() -> dict[str, Tool]:
    tools = {k: v for k, v in _REGISTERED_SIMULATED.items() if v is not None}
    tools.update({k: v for k, v in _REGISTERED_REAL.items() if v is not None})
    return tools


def resolve(tool_name: str, db: Session, user: User) -> ToolResolution:
    tool = _REGISTERED_REAL.get(tool_name)
    if not tool:
        return ToolResolution(tool=None, available=False, reason="tool_unavailable")

    if tool.integration == "google":
        integ = db.scalar(select(Integration).where(Integration.user_id == user.id, Integration.provider == "google"))
        if integ is None or integ.status != "connected" or not integ.encrypted_token:
            return ToolResolution(tool=None, available=False, reason="not_connected")

        granted = set(integ.scopes or [])
        if any(s not in granted for s in tool.required_scopes):
            return ToolResolution(tool=None, available=False, reason="missing_scope")

    return ToolResolution(tool=tool, available=True, reason=None)


def get_known_output_fields(capability: str | None = None, tool_name: str | None = None) -> set[str]:
    fields: set[str] = set()
    if tool_name:
        if tool_name in KNOWN_TOOL_OUTPUT_FIELDS:
            fields.update(KNOWN_TOOL_OUTPUT_FIELDS[tool_name])
        tool_obj = _REGISTERED_REAL.get(tool_name) or _REGISTERED_SIMULATED.get(tool_name)
        if tool_obj and tool_obj.output_fields:
            fields.update(tool_obj.output_fields)
    if capability:
        if capability in KNOWN_CAPABILITY_OUTPUT_FIELDS:
            fields.update(KNOWN_CAPABILITY_OUTPUT_FIELDS[capability])
        for tool_obj in _REGISTERED_REAL.values():
            if tool_obj and tool_obj.capability == capability and tool_obj.output_fields:
                fields.update(tool_obj.output_fields)
    return fields
