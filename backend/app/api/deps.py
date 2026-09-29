"""Shared request dependencies."""

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import User
from app.db.session import get_db

LOCAL_USER_ID = "local"
LOCAL_USER_EMAIL = "local@agentos.dev"


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def current_user(db: Session = Depends(get_db), settings: Settings = Depends(get_settings_dep)) -> User:
    """Placeholder until real authentication (Phase 15).

    In development and test every request acts as a single local user. In
    production this refuses, so a deployed backend can never run open.
    """
    if settings.is_production:
        raise AppError("auth_not_configured", "Authentication is not configured on this server.", status_code=503)
    user = db.get(User, LOCAL_USER_ID)
    if user is None:
        user = User(id=LOCAL_USER_ID, email=LOCAL_USER_EMAIL)
        db.add(user)
        db.commit()
    return user

