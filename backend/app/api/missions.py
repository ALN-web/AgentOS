import asyncio
import json
import time
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain import MissionStatus

from app.api.deps import current_user
from app.db.models import Evidence, Mission, User
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


class AnalyzeRequest(BaseModel):
    goal: str
    answers: dict | None = None


@router.post("/analyze")
def analyze_mission(body: AnalyzeRequest, db: Session = Depends(get_db), user: User = Depends(current_user)):
    from app.services.planner import get_planner
    
    planner = get_planner()
    plan = planner.plan(goal=body.goal, answers=body.answers or {}, db=db, user=user)
    
    if plan:
        return {
            "intent": plan.intent.model_dump(),
            "plan": plan.model_dump(),
            "planner": "llm"
        }
        
    return {"plan": None, "planner": "fallback"}


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
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    from app.services.runner import run_mission
    return _detail(run_mission(db, user, mission_id, request.app.state.google))


@router.post("/{mission_id}/cancel", response_model=MissionDetail)
def cancel_mission(mission_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Stops the mission. Pending approvals are closed, so nothing more can run."""
    from app.services.runner import cancel_mission
    return _detail(cancel_mission(db, user, mission_id))


class ProofEvidenceOut(BaseModel):
    type: str
    label: str
    url: str | None = None
    reference_id: str | None = None
    status: str
    verified_at: datetime | None = None
    method: str | None = None


class CriterionProofOut(BaseModel):
    label: str
    status: str
    evidence: list[ProofEvidenceOut] = []


class ProofBundleOut(BaseModel):
    criteria: list[CriterionProofOut] = []


class EvidenceItemOut(BaseModel):
    id: str
    type: str
    source: str
    label: str
    url: str | None
    reference_id: str | None
    status: str = "unverified"
    verified_at: datetime | None = None
    method: str | None = None
    created_at: datetime


@router.get("/{mission_id}/stream")
async def stream_events(
    mission_id: str,
    request: Request,
    after: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    # Owner-only verification: raises 404 AppError if not found or belongs to another user
    svc.get_mission(db, user, mission_id)

    # Respect Last-Event-ID header from EventSource reconnect
    last_event_id_hdr = request.headers.get("last-event-id")
    if last_event_id_hdr and last_event_id_hdr.strip().isdigit():
        after = max(after, int(last_event_id_hdr.strip()))

    session_factory = request.app.state.session_factory
    is_live_stream = (
        "text/event-stream" in request.headers.get("accept", "")
        or request.query_params.get("stream", "").lower() in ("true", "1")
        or request.query_params.get("live", "").lower() in ("true", "1")
    )

    async def event_generator():
        current_seq = after
        loop = asyncio.get_running_loop()
        notify_event = asyncio.Event()
        if is_live_stream:
            svc.register_mission_listener(mission_id, loop, notify_event)
        last_heartbeat = time.monotonic()

        try:
            while True:
                if is_live_stream and await request.is_disconnected():
                    break

                with session_factory() as s_db:
                    m = svc.get_mission(s_db, user, mission_id)
                    events = svc.list_events(s_db, user, mission_id, after=current_seq, limit=200)

                for e in events:
                    current_seq = max(current_seq, e.seq)
                    data = json.dumps({
                        "seq": e.seq,
                        "type": e.type,
                        "agent": e.agent,
                        "payload": e.payload_json,
                        "created_at": e.created_at.isoformat() if e.created_at else None,
                    })
                    yield f"id: {e.seq}\nevent: {e.type}\ndata: {data}\n\n"

                # If non-streaming snapshot request, or mission reached terminal state, stop
                if not is_live_stream or m.status in (MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.CANCELLED):
                    break

                notify_event.clear()
                try:
                    await asyncio.wait_for(notify_event.wait(), timeout=0.5)
                except asyncio.TimeoutError:
                    pass

                now = time.monotonic()
                if now - last_heartbeat >= 15.0:
                    last_heartbeat = now
                    yield ": heartbeat\n\n"

        finally:
            if is_live_stream:
                svc.unregister_mission_listener(mission_id, loop, notify_event)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{mission_id}/evidence", response_model=list[EvidenceItemOut])
def list_evidence(
    mission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    svc.get_mission(db, user, mission_id)  # 404 unless the mission is yours
    evs = db.scalars(
        select(Evidence)
        .join(Mission, Evidence.mission_id == Mission.id)
        .where(Evidence.mission_id == mission_id, Mission.user_id == user.id)
    ).all()
    return [
        EvidenceItemOut(
            id=e.id,
            type=e.type,
            source=e.source,
            label=e.label,
            url=e.url,
            reference_id=e.reference_id,
            status=e.status,
            verified_at=e.verified_at,
            method=e.method,
            created_at=e.created_at,
        )
        for e in evs
    ]


@router.get("/{mission_id}/proof", response_model=ProofBundleOut)
def get_mission_proof(
    mission_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    from app.services.verification import build_proof_bundle
    return build_proof_bundle(db, user, mission_id)


@router.post("/{mission_id}/verify", response_model=ProofBundleOut)
def reverify_mission_endpoint(
    mission_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    from app.services.verification import reverify_mission
    return reverify_mission(db, user, mission_id, getattr(request.app.state, "google", None))


