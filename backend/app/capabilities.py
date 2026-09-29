"""Capability registry: the Python mirror of src/agentos/capabilities.js.

The planner reasons about capabilities; each capability belongs to an agent.
`tool_bindings` names the real tools a capability will use once they exist
(Priority 2, #6). `live_tools` lists the ones actually available right now,
which is none until real tools are registered, so everything else runs
simulated. A test keeps this registry in step with the frontend's.
"""

from dataclasses import dataclass, field

from app.domain import RiskLevel


@dataclass(frozen=True)
class Capability:
    id: str
    name: str
    agent: str
    external: bool
    risk: RiskLevel
    tool_bindings: tuple[str, ...] = field(default_factory=tuple)


def _cap(id_, name, agent, external=False, risk=None, tools=()):
    # External actions default to HIGH (always approval-gated); the rest are LOW
    # unless stated otherwise.
    return Capability(id_, name, agent, external, risk or (RiskLevel.HIGH if external else RiskLevel.LOW), tuple(tools))


CAPABILITIES: tuple[Capability, ...] = (
    _cap("planning", "Planning", "planner"),
    _cap("research", "Research", "research", tools=("web.search",)),
    _cap("search", "Web Search", "browser", tools=("web.search",)),
    _cap("browser", "Browser Automation", "browser", risk=RiskLevel.MEDIUM, tools=("browser.navigate",)),
    _cap("analysis", "Analysis & Review", "critic"),
    _cap("document", "Document Creation", "execution", risk=RiskLevel.MEDIUM, tools=("gmail.create_draft",)),
    _cap("communication", "Communication", "execution", external=True, tools=("gmail.send_draft",)),
    _cap("submission", "Submission", "browser", external=True),
    _cap("purchasing", "Purchasing & Booking", "execution", external=True),
    _cap("monitoring", "Monitoring", "execution"),
    _cap("verification", "Verification", "verification"),
    _cap("recovery", "Recovery", "recovery"),
    _cap("calendar", "Calendar", "execution", external=True, tools=("calendar.list_events", "calendar.create_event")),
    _cap("email", "Email", "execution", external=True, tools=("gmail.create_draft", "gmail.send_draft")),
    _cap("reminders", "Reminders", "execution", external=True, tools=("calendar.create_event",)),
    _cap("approval", "Human Approval", "approval"),
)

CAPABILITY_BY_ID: dict[str, Capability] = {c.id: c for c in CAPABILITIES}

# Reusable task types, each mapped to the capability that performs it.
TASK_TYPES: dict[str, str] = {
    "analyze": "planning",
    "research": "research",
    "search": "search",
    "compare": "analysis",
    "create": "document",
    "draft": "document",
    "browse": "browser",
    "communicate": "communication",
    "submit": "submission",
    "purchase": "purchasing",
    "monitor": "monitoring",
    "verify": "verification",
    "recover": "recovery",
    "schedule": "calendar",
    "inbox": "email",
    "remind": "reminders",
}


def live_tools(capability: Capability, available: frozenset[str] = frozenset()) -> list[str]:
    """Bound tools that are actually registered and usable. Empty until Priority 2."""
    return [t for t in capability.tool_bindings if t in available]
