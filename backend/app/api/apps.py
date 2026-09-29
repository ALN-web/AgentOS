"""Connected apps: catalogue, per-app permissions, activity and disconnect (#11)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.db.models import User
from app.db.session import get_db
from app.services import apps as svc

router = APIRouter(prefix="/apps", tags=["apps"])

AppId = Path(min_length=1, max_length=40, pattern=r"^[a-z0-9-]+$")


class ActionOut(BaseModel):
    id: str
    label: str
    risk: str
    capability: str
    mode: str
    live: bool


class AppOut(BaseModel):
    id: str
    name: str
    provider: str
    category: str
    icon: str
    description: str
    disconnect_warning: str
    status: str  # connected | available | demo | coming_soon
    account_email: str | None
    granted_scopes: list[str]
    actions: list[ActionOut]


class PermissionsIn(BaseModel):
    actions: dict[str, str] = Field(min_length=1, max_length=20, description="action_id -> allowed | ask | off")


class DisconnectOut(BaseModel):
    id: str
    disconnected: bool
    affected_apps: list[str]


class EvidenceOut(BaseModel):
    label: str
    url: str | None


class ActivityOut(BaseModel):
    mission_id: str
    goal: str
    action: str
    status: str
    created_at: datetime
    evidence: list[EvidenceOut]


@router.get("", response_model=list[AppOut])
def list_apps(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.list_apps(db, user)


@router.patch("/{app_id}/permissions", response_model=AppOut)
def update_permissions(
    body: PermissionsIn, app_id: str = AppId, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    return svc.update_permissions(db, user, app_id, body.actions)


@router.get("/{app_id}/activity", response_model=list[ActivityOut])
def app_activity(
    app_id: str = AppId,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return svc.activity(db, user, app_id, limit)


@router.delete("/{app_id}", response_model=DisconnectOut)
def disconnect(app_id: str = AppId, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return svc.disconnect(db, user, app_id)
