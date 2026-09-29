from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.domain import MissionSource

from .plan import MissionPlan


class MissionCreate(BaseModel):
    goal: str = Field(min_length=1, max_length=500)
    plan: MissionPlan
    # How the user asked: typed, spoken (transcribed in the browser) or from a template.
    source: MissionSource = MissionSource.TYPED
    template_id: str | None = Field(default=None, min_length=1, max_length=60, pattern=r"^[a-z0-9-]+$")

    @field_validator("goal")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("goal must not be empty")
        return v

    @model_validator(mode="after")
    def _template_only_for_template_source(self):
        if self.source == MissionSource.TEMPLATE and not self.template_id:
            raise ValueError("template_id is required when source is 'template'")
        if self.source != MissionSource.TEMPLATE and self.template_id:
            raise ValueError("template_id is only allowed when source is 'template'")
        return self

    @model_validator(mode="after")
    def _plan_matches_goal(self):
        # Same normalisation as the frontend planner's cleanGoal (src/agentos/intent.js).
        if normalise_goal(self.plan.goal) != normalise_goal(self.goal):
            raise ValueError("plan.goal must match goal")
        return self


def normalise_goal(goal: str) -> str:
    return " ".join(goal.split()).rstrip(".!")


class Metric(BaseModel):
    label: str
    current: int
    target: int


class MissionSummary(BaseModel):
    id: str
    goal: str
    mode: str
    status: str
    source: str
    template_id: str | None
    metric: Metric
    task_count: int
    approval_points: int
    created_at: datetime
    updated_at: datetime


class IntentOut(BaseModel):
    objective: str
    domain: str
    desired_outcome: str


class TaskOut(BaseModel):
    key: str
    title: str
    type: str | None
    capability: str | None
    agent: str
    status: str
    gated: bool
    criterion: str | None
    deps: list[str]


class MissionDetail(MissionSummary):
    intent: IntentOut
    tasks: list[TaskOut]
    plan: dict


class EventOut(BaseModel):
    seq: int
    type: str
    agent: str | None
    payload: dict
    created_at: datetime
