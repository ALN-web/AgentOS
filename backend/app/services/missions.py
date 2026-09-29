"""Mission persistence and the append-only mission event log."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.db.models import Agent, Mission, MissionEvent, MissionIntent, Task, TaskDependency, User
from app.domain import AGENTS, EventType, MissionStatus, TaskStatus
from app.schemas.mission import MissionCreate


def ensure_reference_data(db: Session) -> None:
    """Idempotently seed the agent catalogue."""
    existing = set(db.scalars(select(Agent.id)))
    for agent_id, (name, role) in AGENTS.items():
        if agent_id not in existing:
            db.add(Agent(id=agent_id, name=name, role=role))
    db.commit()


def append_event(db: Session, mission: Mission, type_: EventType, agent: str | None = None, payload: dict | None = None) -> MissionEvent:
    """Add the next event for a mission. `seq` is unique per mission (enforced by the schema)."""
    last = db.scalar(select(func.max(MissionEvent.seq)).where(MissionEvent.mission_id == mission.id)) or 0
    event = MissionEvent(mission_id=mission.id, seq=last + 1, type=str(type_), agent=agent, payload_json=payload or {})
    db.add(event)
    return event


def create_mission(db: Session, user: User, data: MissionCreate) -> Mission:
    plan = data.plan
    mission = Mission(
        user_id=user.id,
        goal=data.goal,
        mode="live",
        status=MissionStatus.PLANNED,
        source=data.source.value,
        template_id=data.template_id,
        # Store exactly what the planner produced, without defaults the schema filled in.
        plan_json=plan.model_dump(mode="json", exclude_unset=True),
        metric_label=plan.metric.label,
        metric_current=0,
        metric_target=plan.metric.target,
    )
    mission.intent = MissionIntent(
        objective=plan.intent.objective,
        domain=plan.intent.domain,
        desired_outcome=plan.intent.desiredOutcome,
        intent_json=plan.intent.model_dump(mode="json", exclude_unset=True),
    )
    by_key: dict[str, Task] = {}
    for position, t in enumerate(plan.tasks):
        task = Task(
            key=t.id,
            position=position,
            title=t.title,
            type=t.type,
            capability=t.capability,
            agent=t.agent,
            status=TaskStatus.PENDING,
            gated=t.gated,
            criterion=t.criterion,
        )
        mission.tasks.append(task)
        by_key[t.id] = task
    db.add(mission)
    db.flush()  # assign task ids before wiring dependencies

    for t in plan.tasks:
        for dep in t.deps:
            db.add(TaskDependency(task_id=by_key[t.id].id, depends_on_id=by_key[dep].id))

    append_event(
        db, mission, EventType.MISSION_CREATED, "planner",
        {"goal": mission.goal, "tasks": len(plan.tasks), "source": mission.source, "template_id": mission.template_id},
    )
    db.commit()
    return get_mission(db, user, mission.id)


def list_missions(db: Session, user: User) -> list[Mission]:
    stmt = (
        select(Mission)
        .where(Mission.user_id == user.id)
        .options(selectinload(Mission.tasks))
        .order_by(Mission.created_at.desc())
    )
    return list(db.scalars(stmt))


def get_mission(db: Session, user: User, mission_id: str) -> Mission:
    stmt = (
        select(Mission)
        .where(Mission.id == mission_id, Mission.user_id == user.id)
        .options(
            selectinload(Mission.intent),
            selectinload(Mission.tasks).selectinload(Task.dependencies).selectinload(TaskDependency.depends_on),
        )
    )
    mission = db.scalar(stmt)
    # Another user's mission is indistinguishable from a missing one.
    if mission is None:
        raise AppError("mission_not_found", "Mission not found.", status_code=404)
    return mission


def list_events(db: Session, user: User, mission_id: str, after: int, limit: int) -> list[MissionEvent]:
    get_mission(db, user, mission_id)
    stmt = (
        select(MissionEvent)
        .where(MissionEvent.mission_id == mission_id, MissionEvent.seq > after)
        .order_by(MissionEvent.seq)
        .limit(limit)
    )
    return list(db.scalars(stmt))
