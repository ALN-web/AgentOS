"""Mission API. Missions are stored and listed; execution arrives in later phases."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.db.models import Mission, User
from app.db.session import get_db
from app.schemas.mission import EventOut, IntentOut, Metric, MissionCreate, MissionDetail, MissionSummary, TaskOut
from app.schemas.plan import redact_dict
from app.services import missions as svc

router = APIRouter(prefix="/missions", tags=["missions"])


def _summary(m: Mission) -> dict:
    return dict(
        id=m.id,
        goal=m.goal,
        mode=m.mode,
        status=m.status,
        source=m.source,
        template_id=m.template_id,
        metric=Metric(label=m.metric_label, current=m.metric_current, target=m.metric_target),
        task_count=len(m.tasks),
        approval_points=sum(1 for t in m.tasks if t.gated),
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _detail(m: Mission) -> MissionDetail:
    return MissionDetail(
        **_summary(m),
        intent=IntentOut(objective=m.intent.objective, domain=m.intent.domain, desired_outcome=m.intent.desired_outcome),
        tasks=[
            TaskOut(
                key=t.key,
                title=t.title,
                type=t.type,
                capability=t.capability,
                agent=t.agent,
                status=t.status,
                gated=t.gated,
                criterion=t.criterion,
                deps=[d.depends_on.key for d in t.dependencies],
                inputs=redact_dict(t.inputs or {}),
                output_summary=redact_dict(t.output) if t.output else None,
            )
            for t in m.tasks
        ],
        plan=m.plan_json,
    )


@router.post("", response_model=MissionDetail, status_code=status.HTTP_201_CREATED)
def create_mission(body: MissionCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _detail(svc.create_mission(db, user, body))


@router.get("", response_model=list[MissionSummary])
def list_missions(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [MissionSummary(**_summary(m)) for m in svc.list_missions(db, user)]


@router.get("/{mission_id}", response_model=MissionDetail)
def get_mission(mission_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return _detail(svc.get_mission(db, user, mission_id))


@router.get("/{mission_id}/events", response_model=list[EventOut])
def list_events(
    mission_id: str,
    after: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return [
        EventOut(seq=e.seq, type=e.type, agent=e.agent, payload=e.payload_json, created_at=e.created_at)
        for e in svc.list_events(db, user, mission_id, after, limit)
    ]


@router.post("/{mission_id}/start", response_model=MissionDetail)
def start_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    from app.services.runner import run_mission
    return _detail(run_mission(db, user, mission_id))

