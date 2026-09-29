"""The everyday app catalogue.

Apps, the actions AgentOS can take in each, and the risk of each action. App
and action ids match the frontend catalogue (src/data/apps.js). An app's
status is never hard-coded: it is derived from the tool registry and the
user's connected integrations (see app.services.apps).

Risk follows the approval rule used everywhere else: anything that acts
outside AgentOS (sends, posts, creates or changes shared things) is HIGH and
always asks first; destructive actions are CRITICAL and off by default.
"""

from dataclasses import dataclass

from app.domain import RiskLevel

L, M, H, C = RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL


@dataclass(frozen=True)
class AppAction:
    id: str
    label: str
    risk: RiskLevel
    capability: str


@dataclass(frozen=True)
class AppDef:
    id: str
    name: str
    provider: str
    category: str
    icon: str
    description: str
    disconnect_warning: str
    integration: str | None  # OAuth provider key, e.g. "google"
    scopes: tuple[str, ...]
    in_demo: bool  # simulated in Demo Mode missions
    actions: tuple[AppAction, ...]


def _a(id_, label, risk, capability):
    return AppAction(id_, label, risk, capability)


APPS: tuple[AppDef, ...] = (
    AppDef(
        "google-calendar", "Google Calendar", "Google", "Google Workspace", "Calendar",
        "Schedule meetings, check availability and coordinate events.",
        "AgentOS will no longer be able to check your availability or schedule events.",
        "google", ("https://www.googleapis.com/auth/calendar.events",), True,
        (
            _a("calendar.read", "Read calendar & check availability", L, "calendar"),
            _a("calendar.create_event", "Create calendar events", H, "calendar"),
            _a("calendar.update_event", "Reschedule or edit existing events", H, "calendar"),
            _a("calendar.delete_event", "Delete or cancel calendar events", C, "calendar"),
        ),
    ),
    AppDef(
        "gmail", "Gmail", "Google", "Google Workspace", "Mail",
        "Draft, send and follow up on emails.",
        "AgentOS will no longer be able to draft or send emails for you.",
        "google", ("https://www.googleapis.com/auth/gmail.compose",), True,
        (
            _a("gmail.read", "Read emails & search threads", L, "email"),
            _a("gmail.create_draft", "Create email drafts", M, "document"),  # nothing leaves the account
            _a("gmail.send_draft", "Send emails on your behalf", H, "email"),
            _a("gmail.delete", "Permanently delete or trash messages", C, "email"),
        ),
    ),
    AppDef(
        "google-drive", "Google Drive", "Google", "Google Workspace", "HardDrive",
        "Find documents and save deliverables.",
        "AgentOS will no longer be able to read or save files.",
        "google", ("https://www.googleapis.com/auth/drive.file",), True,
        (
            _a("drive.search", "Search files & read documents", L, "research"),
            _a("drive.upload", "Upload files & export deliverables", M, "document"),
            _a("drive.delete", "Delete files or move to trash", C, "document"),
        ),
    ),
    AppDef(
        "google-forms", "Google Forms", "Google", "Google Workspace", "ClipboardList",
        "Create registration forms and read responses.",
        "AgentOS will no longer be able to create forms or count responses.",
        "google", ("https://www.googleapis.com/auth/forms.body",), True,
        (
            _a("forms.read_responses", "Read form responses", L, "monitoring"),
            _a("forms.create", "Generate new registration forms", M, "browser"),
        ),
    ),
    AppDef(
        "slack", "Slack", "Slack", "Team chat", "MessageSquare",
        "Read channels and post updates to your team.",
        "AgentOS will no longer be able to post in Slack.",
        None, (), False,
        (
            _a("slack.read_channels", "Read public channel messages", L, "research"),
            _a("slack.post_message", "Post messages & updates", H, "communication"),
            _a("slack.admin", "Manage channels and members", C, "communication"),
        ),
    ),
    AppDef(
        "whatsapp", "WhatsApp", "Meta", "Messaging", "MessageCircle",
        "Send and read personal messages.",
        "AgentOS will no longer be able to message your contacts.",
        None, (), False,
        (
            _a("whatsapp.read_messages", "Read incoming messages", L, "research"),
            _a("whatsapp.send_message", "Send direct messages", H, "communication"),
        ),
    ),
    AppDef(
        "notion", "Notion", "Notion", "Notes & docs", "FileText",
        "Search your workspace and create pages.",
        "AgentOS will no longer be able to read or write Notion pages.",
        None, (), False,
        (
            _a("notion.search", "Search workspace & read pages", L, "research"),
            _a("notion.create_page", "Create pages & database items", M, "document"),
            _a("notion.update_database", "Update database schemas", H, "document"),
        ),
    ),
    AppDef(
        "discord", "Discord", "Discord", "Community", "Hash",
        "Read community channels and post announcements.",
        "AgentOS will no longer be able to post in your community.",
        None, (), True,
        (
            _a("discord.read_channels", "Read community channels", L, "research"),
            _a("discord.post_announcement", "Post community announcements", H, "communication"),
        ),
    ),
)

APP_BY_ID: dict[str, AppDef] = {a.id: a for a in APPS}
ACTION_TO_APP: dict[str, AppDef] = {act.id: app for app in APPS for act in app.actions}
ACTION_BY_ID: dict[str, AppAction] = {act.id: act for app in APPS for act in app.actions}


def default_mode(risk: RiskLevel) -> str:
    return {L: "allowed", M: "allowed", H: "ask", C: "off"}[risk]


def max_mode(risk: RiskLevel, mode: str) -> str:
    """Clamp a stored mode to what the risk permits: HIGH/CRITICAL are never 'allowed'."""
    if mode == "allowed" and risk in (H, C):
        return "ask"
    return mode
