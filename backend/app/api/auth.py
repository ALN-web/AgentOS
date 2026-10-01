"""Sign up, log in, log out and "who am I" (#32), matching the #33 frontend.

Responses are `{user: {id, email, name}}`. The session lives in an httpOnly,
SameSite=Lax cookie with no Domain attribute, so it also reaches the Google OAuth
callback on the backend port. Nothing about the session is readable by scripts.
"""

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import get_settings_dep
from app.core.config import Settings
from app.core.errors import AppError
from app.db.session import get_db
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: str
    password: str
    name: str = ""


class LoginIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str


class UserEnvelope(BaseModel):
    user: UserOut


def _out(user) -> UserEnvelope:
    return UserEnvelope(user=UserOut(id=user.id, email=user.email, name=user.name or ""))


def _set_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        svc.SESSION_COOKIE, token, max_age=svc.SESSION_DAYS * 24 * 3600, path="/",
        httponly=True, samesite="lax", secure=settings.is_production,
    )


def _limit_key(request: Request, email: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{client}|{(email or '').strip().lower()}"


@router.post("/signup", response_model=UserEnvelope, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, request: Request, response: Response, db: Session = Depends(get_db),
           settings: Settings = Depends(get_settings_dep)):
    limiter: svc.AttemptLimiter = request.app.state.auth_limiter
    key = _limit_key(request, body.email)
    limiter.check(key)
    try:
        user = svc.signup(db, body.email, body.password, body.name)
    except AppError:
        limiter.fail(key)
        raise
    _set_cookie(response, svc.create_session(db, user), settings)
    return _out(user)


@router.post("/login", response_model=UserEnvelope)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db),
          settings: Settings = Depends(get_settings_dep)):
    limiter: svc.AttemptLimiter = request.app.state.auth_limiter
    key = _limit_key(request, body.email)
    limiter.check(key)
    try:
        user = svc.authenticate(db, body.email, body.password)
    except AppError:
        limiter.fail(key)
        raise
    limiter.reset(key)
    _set_cookie(response, svc.create_session(db, user), settings)
    return _out(user)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    svc.end_session(db, request.cookies.get(svc.SESSION_COOKIE))
    response.delete_cookie(svc.SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserEnvelope)
def me(request: Request, db: Session = Depends(get_db)):
    # Never falls back to the local dev user: "signed in" means a real session.
    user = svc.user_for_token(db, request.cookies.get(svc.SESSION_COOKIE))
    if user is None:
        raise AppError("not_authenticated", "Sign in to continue.", status_code=401)
    return _out(user)
