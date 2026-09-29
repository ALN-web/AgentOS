"""Connected apps catalogue, permissions, and activity audit endpoints.

Acceptance criteria:
- GET /api/apps: lists apps with honest status and action permissions.
- PATCH /api/apps/{id}/permissions: updates action permissions.
  HIGH and CRITICAL actions can NEVER be set to 'allowed'; rejected with 422.
- GET /api/apps/{id}/activity: returns activity log with evidence links.
- DELETE /api/apps/{id}: disconnects app.
"""

from typing import Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(tags=["apps"])

# Static in-memory database of apps and per-app permission overrides
APPS_CATALOGUE_DATA = [
    {
        "id": "google-calendar",
        "name": "Google Calendar",
        "provider": "Google",
        "category": "Google Workspace",
        "status": "connected",
        "account_email": "alex.chen@agentos.org",
        "granted_scopes": [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
        ],
        "description": "Schedule meetings, check free/busy availability, and coordinate event timelines across team calendars.",
        "actions": [
            {"id": "calendar.read", "label": "Read calendar & check availability", "risk": "LOW", "mode": "allowed"},
            {"id": "calendar.create_event", "label": "Create calendar events", "risk": "MEDIUM", "mode": "allowed"},
            {"id": "calendar.update_event", "label": "Reschedule or edit existing events", "risk": "HIGH", "mode": "ask"},
            {"id": "calendar.delete_event", "label": "Delete or cancel calendar events", "risk": "CRITICAL", "mode": "off"},
        ],
    },
    {
        "id": "gmail",
        "name": "Gmail",
        "provider": "Google",
        "category": "Google Workspace",
        "status": "connected",
        "account_email": "alex.chen@agentos.org",
        "granted_scopes": [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.send",
        ],
        "description": "Draft and review email communications, monitor confirmation replies, and send updates to verified recipients.",
        "actions": [
            {"id": "gmail.read", "label": "Read emails & search threads", "risk": "LOW", "mode": "allowed"},
            {"id": "gmail.create_draft", "label": "Create email drafts", "risk": "LOW", "mode": "allowed"},
            {"id": "gmail.send_draft", "label": "Send emails on your behalf", "risk": "HIGH", "mode": "ask"},
            {"id": "gmail.delete", "label": "Permanently delete or trash messages", "risk": "CRITICAL", "mode": "off"},
        ],
    },
    {
        "id": "google-drive",
        "name": "Google Drive",
        "provider": "Google",
        "category": "Google Workspace",
        "status": "available",
        "account_email": None,
        "granted_scopes": [],
        "description": "Store research briefs, export structured spreadsheets, and share deliverables directly in your team folders.",
        "actions": [
            {"id": "drive.search", "label": "Search files & read documents", "risk": "LOW", "mode": "allowed"},
            {"id": "drive.upload", "label": "Upload files & export deliverables", "risk": "MEDIUM", "mode": "allowed"},
            {"id": "drive.delete", "label": "Delete files or move to trash", "risk": "CRITICAL", "mode": "off"},
        ],
    },
    {
        "id": "google-forms",
        "name": "Google Forms",
        "provider": "Google",
        "category": "Google Workspace",
        "status": "demo",
        "account_email": "demo-student@agentos.org",
        "granted_scopes": ["forms.body", "forms.responses.readonly"],
        "description": "Generate registration surveys, RSVP questionnaires, and feedback collection forms.",
        "actions": [
            {"id": "forms.read_responses", "label": "Read form responses", "risk": "LOW", "mode": "allowed"},
            {"id": "forms.create", "label": "Generate new registration forms", "risk": "MEDIUM", "mode": "allowed"},
        ],
    },
    {
        "id": "slack",
        "name": "Slack",
        "provider": "Slack Technologies",
        "category": "Communication",
        "status": "demo",
        "account_email": "alex.chen@workplace.slack.com",
        "granted_scopes": ["channels:read", "chat:write"],
        "description": "Publish sprint summaries, broadcast milestone alerts, and ping team channels.",
        "actions": [
            {"id": "slack.read_channels", "label": "Read public channel messages", "risk": "LOW", "mode": "allowed"},
            {"id": "slack.post_message", "label": "Post messages & updates", "risk": "MEDIUM", "mode": "allowed"},
            {"id": "slack.admin", "label": "Manage channels and members", "risk": "HIGH", "mode": "ask"},
        ],
    },
    {
        "id": "whatsapp",
        "name": "WhatsApp",
        "provider": "Meta",
        "category": "Communication",
        "status": "demo",
        "account_email": "+1 (555) 234-8901",
        "granted_scopes": ["messages:send", "messages:read"],
        "description": "Send urgent operational alerts and reschedule notifications directly to mobile contacts.",
        "actions": [
            {"id": "whatsapp.read_messages", "label": "Read incoming messages", "risk": "LOW", "mode": "allowed"},
            {"id": "whatsapp.send_message", "label": "Send direct messages", "risk": "HIGH", "mode": "ask"},
        ],
    },
    {
        "id": "notion",
        "name": "Notion",
        "provider": "Notion Labs",
        "category": "Productivity",
        "status": "available",
        "account_email": None,
        "granted_scopes": [],
        "description": "Build structured project wikis, maintain candidate shortlists, and publish knowledge bases.",
        "actions": [
            {"id": "notion.search", "label": "Search workspace & read pages", "risk": "LOW", "mode": "allowed"},
            {"id": "notion.create_page", "label": "Create pages & database items", "risk": "MEDIUM", "mode": "allowed"},
            {"id": "notion.update_database", "label": "Update database schemas", "risk": "HIGH", "mode": "ask"},
        ],
    },
    {
        "id": "discord",
        "name": "Discord",
        "provider": "Discord Inc.",
        "category": "Communication",
        "status": "coming_soon",
        "account_email": None,
        "granted_scopes": [],
        "description": "Community moderation, announcement bot integration, and support ticket triage.",
        "actions": [
            {"id": "discord.read_channels", "label": "Read community channels", "risk": "LOW", "mode": "allowed"},
            {"id": "discord.post_announcement", "label": "Post community announcements", "risk": "MEDIUM", "mode": "allowed"},
        ],
    },
]

# Sample audit log activity
APP_ACTIVITIES: dict[str, list[dict[str, Any]]] = {
    "google-calendar": [
        {
            "mission_id": "m-hero-1",
            "goal": "Organize team retrospective & schedule calendar invite",
            "action": "calendar.create_event",
            "status": "completed",
            "created_at": "2026-09-29T10:30:00Z",
            "evidence": [
                {"label": "Open in Google Calendar", "url": "https://calendar.google.com"},
                {"label": "Audit Proof #GC-4921", "url": "#"},
            ],
        },
        {
            "mission_id": "m-week-1",
            "goal": "Plan my week around my deadlines",
            "action": "calendar.read",
            "status": "completed",
            "created_at": "2026-09-29T08:15:00Z",
            "evidence": [{"label": "Inspect Time Slots", "url": "#"}],
        },
    ],
    "gmail": [
        {
            "mission_id": "m-dinner-1",
            "goal": "Organise a birthday dinner for 8 on Saturday",
            "action": "gmail.create_draft",
            "status": "completed",
            "created_at": "2026-09-29T09:45:00Z",
            "evidence": [
                {"label": "Open in Gmail Drafts", "url": "https://mail.google.com"},
                {"label": "Audit Proof #GM-8104", "url": "#"},
            ],
        }
    ],
    "google-forms": [
        {
            "mission_id": "m-hackathon-1",
            "goal": "Get 100 registrations for our college hackathon",
            "action": "forms.create",
            "status": "completed",
            "created_at": "2026-09-29T07:20:00Z",
            "evidence": [{"label": "View Google Form", "url": "https://docs.google.com/forms"}],
        }
    ],
    "slack": [
        {
            "mission_id": "m-hackathon-1",
            "goal": "Organize a hackathon for 100 students in my college",
            "action": "slack.post_message",
            "status": "completed",
            "created_at": "2026-09-29T05:10:00Z",
            "evidence": [{"label": "View Channel Message", "url": "https://slack.com"}],
        }
    ],
    "whatsapp": [
        {
            "mission_id": "m-rescue-1",
            "goal": "Handle urgent venue reschedule notification",
            "action": "whatsapp.send_message",
            "status": "completed",
            "created_at": "2026-09-28T16:00:00Z",
            "evidence": [{"label": "Audit Log #WA-9014", "url": "#"}],
        }
    ],
}


class UpdatePermissionsIn(BaseModel):
    actions: dict[str, str] = Field(
        ...,
        description="Map of action_id to mode: 'allowed' | 'ask' | 'off'",
        json_schema_extra={"example": {"calendar.create_event": "ask"}},
    )


@router.get("/apps")
def list_apps() -> list[dict[str, Any]]:
    """List all apps in the everyday catalogue with current permissions and honest statuses."""
    return APPS_CATALOGUE_DATA


@router.patch("/apps/{app_id}/permissions")
def update_app_permissions(app_id: str, payload: UpdatePermissionsIn) -> dict[str, Any]:
    """Update permissions for an app.
    
    CRITICAL SAFETY RULE:
    Actions with risk 'HIGH' or 'CRITICAL' can NEVER be set to 'allowed'.
    Attempting to set HIGH or CRITICAL to 'allowed' is rejected with HTTP 422 Unprocessable Entity.
    """
    app = next((a for a in APPS_CATALOGUE_DATA if a["id"] == app_id), None)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"App '{app_id}' not found.")

    # Validate all requested action updates
    for action_id, mode in payload.actions.items():
        if mode not in ("allowed", "ask", "off"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid mode '{mode}'. Must be one of: 'allowed', 'ask', 'off'.",
            )

        act = next((a for a in app["actions"] if a["id"] == action_id), None)
        if not act:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Action '{action_id}' not found in app '{app_id}'.",
            )

        risk = act["risk"]
        # Enforce invariant
        if risk in ("HIGH", "CRITICAL") and mode == "allowed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Action '{action_id}' has {risk} risk and cannot be set to 'allowed'. Must require approval ('ask') or be 'off'.",
            )

    # Apply updates
    for action_id, mode in payload.actions.items():
        for act in app["actions"]:
            if act["id"] == action_id:
                act["mode"] = mode

    return app


@router.get("/apps/{app_id}/activity")
def get_app_activity(app_id: str, limit: int = Query(default=20, ge=1, le=100)) -> list[dict[str, Any]]:
    """Get recent audit log activity for an app."""
    activities = APP_ACTIVITIES.get(app_id, [])
    return activities[:limit]


@router.delete("/apps/{app_id}")
def disconnect_app(app_id: str) -> dict[str, Any]:
    """Disconnect an app and revoke access."""
    app = next((a for a in APPS_CATALOGUE_DATA if a["id"] == app_id), None)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"App '{app_id}' not found.")

    app["status"] = "available"
    app["account_email"] = None
    return {"id": app_id, "disconnected": True}
