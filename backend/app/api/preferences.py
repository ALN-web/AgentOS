"""GET/PUT /api/preferences (#18): the signed-in user's own preferences only."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.preferences import Preferences
from app.services import preferences as svc

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("")
def get_preferences(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    return svc.load_preferences(db, user).as_client()


@router.put("")
def put_preferences(body: Preferences, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    return svc.save_preferences(db, user, body).as_client()
