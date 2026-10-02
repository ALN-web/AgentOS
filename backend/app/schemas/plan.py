"""The MissionPlan contract, validated on the server.

Same shape the frontend planner produces (src/agentos/planner.js), so plans move
between the two without translation. Unknown extra fields are kept, because the
UI uses them for presentation; everything execution relies on is checked here.
"""

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.capabilities import CAPABILITY_BY_ID, TASK_TYPES
from app.domain import AGENTS
from app.tools.registry import get_known_output_fields

TaskId = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")

REF_PATTERN = re.compile(r"^([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)$")
SENSITIVE_WORDS = ("token", "secret", "password", "credential", "api_key", "private_key", "bearer")


def extract_references(data: Any) -> list[tuple[str, str]]:
    """Extract all (task_id, field) references from inputs."""
    refs: list[tuple[str, str]] = []
    if isinstance(data, str):
        trimmed = data.strip()
        m = REF_PATTERN.match(trimmed)
        if m:
            refs.append((m.group(1), m.group(2)))
        else:
            for match in re.finditer(r"([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_]+)", data):
                refs.append((match.group(1), match.group(2)))
    elif isinstance(data, dict):
        for v in data.values():
            refs.extend(extract_references(v))
    elif isinstance(data, list):
        for item in data:
            refs.extend(extract_references(item))
    return refs


def check_no_secrets_or_tokens(data: Any) -> None:
    """Ensure no secret or token can be referenced or passed as a task input."""
    if isinstance(data, dict):
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(w in k_lower for w in SENSITIVE_WORDS):
                raise ValueError("secrets and tokens cannot be referenced or passed as task inputs")
            check_no_secrets_or_tokens(v)
    elif isinstance(data, list):
        for item in data:
            check_no_secrets_or_tokens(item)
    elif isinstance(data, str):
        lower = data.strip().lower()
        if lower.startswith("bearer ") or "-----begin" in lower:
            raise ValueError("secrets and tokens cannot be referenced or passed as task inputs")
        # Check referenced fields as well
        m = REF_PATTERN.match(data.strip())
        if m:
            field_name = m.group(2).lower()
            if any(w in field_name for w in SENSITIVE_WORDS):
                raise ValueError("secrets and tokens cannot be referenced or passed as task inputs")


def redact_dict(data: Any) -> Any:
    """Recursively redact sensitive keys and values from dicts, lists, and strings."""
    if isinstance(data, dict):
        redacted = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(w in k_lower for w in SENSITIVE_WORDS):
                redacted[k] = "[REDACTED]"
            else:
                redacted[k] = redact_dict(v)
        return redacted
    elif isinstance(data, list):
        return [redact_dict(item) for item in data]
    elif isinstance(data, str):
        lower = data.strip().lower()
        if lower.startswith("bearer ") or "-----begin" in lower:
            return "[REDACTED]"
        return data
    return data


class PlanTask(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = TaskId
    title: str = Field(min_length=1, max_length=300)
    agent: str
    deps: list[str] = Field(default_factory=list, max_length=20)
    gated: bool = False
    type: str | None = Field(default=None, max_length=20)
    capability: str | None = Field(default=None, max_length=40)
    criterion: str | None = Field(default=None, max_length=300)
    inputs: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _known_agent_capability_and_type(self):
        if self.agent not in AGENTS:
            raise ValueError(f"unknown agent '{self.agent}'")
        if self.type is not None and self.type not in TASK_TYPES:
            raise ValueError(f"unknown task type '{self.type}'")
        if self.capability is not None:
            cap = CAPABILITY_BY_ID.get(self.capability)
            if cap is None:
                raise ValueError(f"unknown capability '{self.capability}'")
            # Anything that acts outside AgentOS (send, book, pay, schedule) must ask first.
            if cap.external and not self.gated:
                raise ValueError(f"task '{self.id}' uses external capability '{cap.id}' and must require approval (gated)")
        check_no_secrets_or_tokens(self.inputs)
        return self


class PlanIntent(BaseModel):
    model_config = ConfigDict(extra="allow")

    objective: str = Field(min_length=1, max_length=500)
    domain: str = Field(min_length=1, max_length=40)
    desiredOutcome: str = Field(min_length=1, max_length=300)


class PlanMetric(BaseModel):
    kind: Literal["quantity", "criteria"]
    label: str = Field(min_length=1, max_length=120)
    target: int = Field(ge=0, le=1_000_000)


class PlanCriterion(BaseModel):
    model_config = ConfigDict(extra="allow")

    label: str = Field(min_length=1, max_length=300)
    taskId: str | None = None


def wire_send_to_draft(data: dict) -> dict:
    """A send step that depends on a draft step gets the prepared email wired in
    (draft_id, to, subject, body), so its approval shows exactly what will be sent (#37).
    Applies to every plan: AI, rule-based or template."""
    tasks = data.get("tasks") if isinstance(data, dict) else None
    if not isinstance(tasks, list):
        return data
    by_id = {t.get("id"): t for t in tasks if isinstance(t, dict)}

    def is_draft(t: dict) -> bool:
        return (t.get("inputs") or {}).get("tool") == "gmail.create_draft" or t.get("type") == "draft" or t.get("capability") == "document"

    for t in tasks:
        if not isinstance(t, dict):
            continue
        inputs = t.get("inputs") or {}
        sends = inputs.get("tool") == "gmail.send_draft" or t.get("capability") == "communication" or t.get("type") in ("communicate", "send")
        if not sends or (inputs.get("draft_id") and inputs.get("body")):
            continue
        draft = next((d for d in t.get("deps") or [] if isinstance(by_id.get(d), dict) and is_draft(by_id[d])), None)
        if draft:
            # Pass the prepared email itself, so the approval card shows exactly what is sent (#37).
            wired = {"draft_id": f"{draft}.output.draft_id"}
            for field in ("to", "subject", "body"):
                if not inputs.get(field):
                    wired[field] = f"{draft}.output.{field}"
            t["inputs"] = {**inputs, **wired}
    return data


class MissionPlan(BaseModel):
    model_config = ConfigDict(extra="allow")

    kind: Literal["dynamic", "hero"]
    goal: str = Field(min_length=1, max_length=500)
    intent: PlanIntent
    tasks: list[PlanTask] = Field(min_length=1, max_length=60)
    criteria: list[PlanCriterion] = Field(default_factory=list, max_length=60)
    metric: PlanMetric
    approvalPoints: int = Field(ge=0, le=60)
    capabilities: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="before")
    @classmethod
    def _wire_send_steps(cls, data: Any) -> Any:
        return wire_send_to_draft(data) if isinstance(data, dict) else data

    @model_validator(mode="after")
    def _valid_graph(self):
        ids = [t.id for t in self.tasks]
        if len(set(ids)) != len(ids):
            raise ValueError("task ids must be unique")
        known = set(ids)
        tasks_by_id = {t.id: t for t in self.tasks}

        for t in self.tasks:
            for d in t.deps:
                if d == t.id:
                    raise ValueError(f"task '{t.id}' depends on itself")
                if d not in known:
                    raise ValueError(f"task '{t.id}' depends on unknown task '{d}'")

            # Validate input references point only to declared dependencies and known output fields
            refs = extract_references(t.inputs)
            for dep_id, field in refs:
                if dep_id == t.id:
                    raise ValueError(f"task '{t.id}' cannot reference its own output")
                if dep_id not in t.deps:
                    raise ValueError(f"task '{t.id}' references output of '{dep_id}', which is not in its dependencies: {t.deps}")
                dep_task = tasks_by_id.get(dep_id)
                if dep_task:
                    cap = dep_task.capability or TASK_TYPES.get(dep_task.type or "")
                    known_fields = get_known_output_fields(cap)
                    if known_fields and field not in known_fields:
                        raise ValueError(f"task '{t.id}' references unknown output field '{field}' of task '{dep_id}' (capability '{cap}')")

        # Reject cycles (Kahn's algorithm).
        remaining = {t.id: set(t.deps) for t in self.tasks}
        while remaining:
            ready = [tid for tid, deps in remaining.items() if not deps]
            if not ready:
                raise ValueError("task dependencies contain a cycle")
            for tid in ready:
                del remaining[tid]
            for deps in remaining.values():
                deps.difference_update(ready)
        if self.approvalPoints != sum(1 for t in self.tasks if t.gated):
            raise ValueError("approvalPoints must equal the number of gated tasks")
        for c in self.criteria:
            if c.taskId is not None and c.taskId not in known:
                raise ValueError(f"criterion refers to unknown task '{c.taskId}'")
        return self
