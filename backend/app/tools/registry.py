"""Tool registry: which real tools exist in this build.

Priority 2 (#6) and Priority 5 (#12) register real tools here.
"""

from typing import Union

from app.tools.base import Tool

_REGISTERED: set[str] = set()
_TOOL_INSTANCES: dict[str, Tool] = {}

KNOWN_TOOL_OUTPUT_FIELDS: dict[str, set[str]] = {
    "calendar.list_events": {"events", "free_slots", "count", "start", "end"},
    "calendar.create_event": {"event_id", "html_link", "start", "end", "summary", "status", "idempotency_key", "hangout_link", "attendees"},
    "gmail.create_draft": {"draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link"},
    "gmail.send_draft": {"message_id", "thread_id", "status", "sent_at", "body", "subject", "to"},
    "web.search": {"results", "query", "snippets", "urls"},
    "browser.navigate": {"url", "title", "content", "status"},
}

KNOWN_CAPABILITY_OUTPUT_FIELDS: dict[str, set[str]] = {
    "calendar": {"events", "free_slots", "count", "start", "end", "event_id", "html_link", "summary", "status", "idempotency_key", "hangout_link", "attendees"},
    "email": {"draft_id", "message_id", "thread_id", "subject", "body", "to", "status", "sent_at", "html_link"},
    "document": {"draft_id", "message_id", "thread_id", "subject", "body", "to", "html_link", "content", "title"},
    "communication": {"message_id", "thread_id", "status", "sent_at", "body", "subject", "to"},
    "reminders": {"event_id", "html_link", "start", "end", "summary", "status"},
    "search": {"results", "query", "snippets", "urls", "start", "end", "free_slots", "slots"},
    "research": {"results", "query", "snippets", "urls", "data", "start", "end"},
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
        _REGISTERED.add(tool.name)
        _TOOL_INSTANCES[tool.name] = tool
    else:
        _REGISTERED.add(str(tool))


def unregister_tool(name: str) -> None:
    _REGISTERED.discard(name)
    _TOOL_INSTANCES.pop(name, None)


def registered_tools() -> frozenset[str]:
    return frozenset(_REGISTERED)


def get_tool(name: str) -> Tool | None:
    return _TOOL_INSTANCES.get(name)


def get_all_tools() -> dict[str, Tool]:
    return dict(_TOOL_INSTANCES)


def get_known_output_fields(capability: str | None = None, tool_name: str | None = None) -> set[str]:
    fields: set[str] = set()
    if tool_name:
        if tool_name in KNOWN_TOOL_OUTPUT_FIELDS:
            fields.update(KNOWN_TOOL_OUTPUT_FIELDS[tool_name])
        tool_obj = _TOOL_INSTANCES.get(tool_name)
        if tool_obj and tool_obj.output_fields:
            fields.update(tool_obj.output_fields)
    if capability:
        if capability in KNOWN_CAPABILITY_OUTPUT_FIELDS:
            fields.update(KNOWN_CAPABILITY_OUTPUT_FIELDS[capability])
        for tool_obj in _TOOL_INSTANCES.values():
            if tool_obj.capability == capability and tool_obj.output_fields:
                fields.update(tool_obj.output_fields)
    return fields
