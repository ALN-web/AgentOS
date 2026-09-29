"""Shared vocabularies. Kept as StrEnums so they serialise as plain strings."""

from enum import StrEnum


class MissionStatus(StrEnum):
    PLANNED = "planned"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    RECOVERING = "recovering"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MissionSource(StrEnum):
    TYPED = "typed"
    VOICE = "voice"
    TEMPLATE = "template"


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING = "awaiting"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class EventType(StrEnum):
    MISSION_CREATED = "MISSION_CREATED"
    MISSION_STARTED = "MISSION_STARTED"
    TASK_STARTED = "TASK_STARTED"
    AGENT_ASSIGNED = "AGENT_ASSIGNED"
    TOOL_CALLED = "TOOL_CALLED"
    TOOL_COMPLETED = "TOOL_COMPLETED"
    APPROVAL_REQUESTED = "APPROVAL_REQUESTED"
    APPROVAL_GRANTED = "APPROVAL_GRANTED"
    APPROVAL_REJECTED = "APPROVAL_REJECTED"
    TASK_FAILED = "TASK_FAILED"
    RECOVERY_STARTED = "RECOVERY_STARTED"
    PLAN_UPDATED = "PLAN_UPDATED"
    VERIFICATION_STARTED = "VERIFICATION_STARTED"
    VERIFICATION_COMPLETED = "VERIFICATION_COMPLETED"
    MISSION_COMPLETED = "MISSION_COMPLETED"
    MISSION_FAILED = "MISSION_FAILED"


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# The eight capability-oriented agents, matching the frontend's src/data/agents.js.
AGENTS: dict[str, tuple[str, str]] = {
    "planner": ("Planner", "Turns a goal into a plan."),
    "research": ("Research", "Finds what the plan needs."),
    "execution": ("Execution", "Runs the mission."),
    "browser": ("Browser", "Uses websites like a person."),
    "verification": ("Verification", "Checks the work."),
    "critic": ("Critic", "Challenges the plan."),
    "recovery": ("Recovery", "Fixes what breaks."),
    "approval": ("Approval", "Asks before anything risky."),
}
