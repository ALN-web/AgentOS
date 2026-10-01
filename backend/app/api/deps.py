"""Shared request dependencies."""

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import User
from app.db.session import get_db
from app.services.auth import SESSION_COOKIE, user_for_token

LOCAL_USER_ID = "local"
LOCAL_USER_EMAIL = "local@agentos.dev"


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def current_user(request: Request, db: Session = Depends(get_db), settings: Settings = Depends(get_settings_dep)) -> User:
    """The signed-in user, from the session cookie (#32).

    Without a valid session the request is refused with 401. Only the test suite
    (or an explicit AGENTOS_AUTH_LOCAL_FALLBACK=true outside production) acts as a
    single local user, so a running server can never be used without signing in.
    """
    user = user_for_token(db, request.cookies.get(SESSION_COOKIE))
    if user is not None:
        return user
    if not settings.allows_local_user:
        raise AppError("not_authenticated", "Sign in to continue.", status_code=401)
    user = db.get(User, LOCAL_USER_ID)
    if user is None:
        user = User(id=LOCAL_USER_ID, email=LOCAL_USER_EMAIL)
        db.add(user)
        db.commit()
    return user
