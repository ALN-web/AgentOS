"""Approval Gateway API for human-in-the-loop decisions."""

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.errors import AppError
from app.db.models import Approval, Mission, User
from app.db.session import get_db
from app.schemas.plan import redact_dict
from app.services.runner import handle_approval_decision

router = APIRouter(prefix="/approvals", tags=["approvals"])


class ApprovalDecisionIn(BaseModel):
    decision: Literal["approve", "edit", "reject"]
    edits: dict[str, Any] | None = None
    input: Literal["click", "voice"] = "click"


class ApprovalOut(BaseModel):
    id: str
    mission_id: str
    task_id: str | None
    tool_name: str | None
    risk: str
    category: str | None
    reason: str
    payload: dict
    original_payload: dict
    status: str
    requested_at: datetime
    decided_at: datetime | None
    decided_by: str | None
    input: str | None


def _approval_out(a: Approval) -> ApprovalOut:
    return ApprovalOut(
        id=a.id,
        mission_id=a.mission_id,
        task_id=a.task_id,
        tool_name=a.tool_name,
        risk=a.risk,
        category=a.category,
        reason=a.reason,
        payload=redact_dict(a.payload_json),
        original_payload=redact_dict(a.original_payload_json),
        status=a.status,
        requested_at=a.requested_at,
        decided_at=a.decided_at,
        decided_by=a.decided_by,
        input=getattr(a, "input", None),
    )

@router.get("", response_model=list[ApprovalOut])
def list_approvals(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = (
        select(Approval)
        .join(Mission, Approval.mission_id == Mission.id)
        .where(Mission.user_id == user.id)
    )
    if status:
        stmt = stmt.where(Approval.status == status)
    stmt = stmt.order_by(Approval.requested_at.desc())
    return [_approval_out(a) for a in db.scalars(stmt)]


@router.get("/{approval_id}", response_model=ApprovalOut)
def get_approval(
    approval_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = (
        select(Approval)
        .join(Mission, Approval.mission_id == Mission.id)
        .where(Approval.id == approval_id, Mission.user_id == user.id)
    )
    approval = db.scalar(stmt)
    if approval is None:
        raise AppError("approval_not_found", "Approval request not found.", status_code=404)
    return _approval_out(approval)


@router.post("/{approval_id}/decision", response_model=ApprovalOut)
def decide_approval(
    approval_id: str,
    body: ApprovalDecisionIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    approval = handle_approval_decision(
        db=db,
        user=user,
        approval_id=approval_id,
        decision=body.decision,
        edits=body.edits,
        google=request.app.state.google,
        input_type=body.input
    )
    return _approval_out(approval)
