"""The MissionPlan contract, validated on the server.

Same shape the frontend planner produces (src/agentos/planner.js), so plans move
between the two without translation. Unknown extra fields are kept, because the
UI uses them for presentation; everything execution relies on is checked here.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.capabilities import CAPABILITY_BY_ID, TASK_TYPES
from app.domain import AGENTS

TaskId = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")


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

    @model_validator(mode="after")
    def _valid_graph(self):
        ids = [t.id for t in self.tasks]
        if len(set(ids)) != len(ids):
            raise ValueError("task ids must be unique")
        known = set(ids)
        for t in self.tasks:
            for d in t.deps:
                if d == t.id:
                    raise ValueError(f"task '{t.id}' depends on itself")
                if d not in known:
                    raise ValueError(f"task '{t.id}' depends on unknown task '{d}'")
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
