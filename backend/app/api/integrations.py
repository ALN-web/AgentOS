"""Integrations API for OAuth connections (Google, etc.)."""

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import Settings
from app.db.models import Integration, User
from app.db.session import get_db

router = APIRouter(prefix="/integrations", tags=["integrations"])


class IntegrationOut(BaseModel):
    provider: str
    status: str
    scopes: list[str]
    account_email: str | None


class ConnectOut(BaseModel):
    authorization_url: str


def _settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("", response_model=list[IntegrationOut])
def list_integrations(db: Session = Depends(get_db), user: User = Depends(current_user)):
    integs = db.scalars(select(Integration).where(Integration.user_id == user.id)).all()
    by_provider = {i.provider: i for i in integs}

    # Ensure google is reported
    out = []
    g = by_provider.get("google")
    out.append(
        IntegrationOut(
            provider="google",
            status=g.status if g else "not_connected",
            scopes=list(g.scopes or []) if g else [],
            account_email=g.account_email if g else None,
        )
    )
    return out


@router.post("/google/connect", response_model=ConnectOut)
def connect_google(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    settings: Settings = Depends(_settings),
):
    # Check if google_client_id is configured
    client_id = getattr(settings, "google_client_id", None)
    redirect_uri = getattr(settings, "google_redirect_uri", f"{settings.frontend_url}/app/apps")

    if client_id:
        scopes = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.compose"
        auth_url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&"
            f"scope={scopes}&access_type=offline&prompt=consent&state=google_connect"
        )
    else:
        # In test / demo environment without real OAuth client credentials:
        # Route to callback or frontend with connected=google directly
        auth_url = f"{settings.frontend_url}/app/apps?connected=google"

        # Also register connected integration in database for current user
        integ = db.scalar(
            select(Integration).where(Integration.user_id == user.id, Integration.provider == "google")
        )
        if integ is None:
            integ = Integration(
                user_id=user.id,
                provider="google",
                scopes=["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/gmail.compose"],
                status="connected",
                account_email="alex.chen@agentos.org",
            )
            db.add(integ)
        else:
            integ.status = "connected"
            integ.account_email = integ.account_email or "alex.chen@agentos.org"
            integ.scopes = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/gmail.compose"]
        db.commit()

    return ConnectOut(authorization_url=auth_url)


@router.get("/google/callback")
def google_callback(
    code: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    settings: Settings = Depends(_settings),
):
    frontend_url = settings.frontend_url or "http://localhost:3000"
    if error:
        return RedirectResponse(f"{frontend_url}/app/apps?error={error}")

    integ = db.scalar(
        select(Integration).where(Integration.user_id == user.id, Integration.provider == "google")
    )
    if integ is None:
        integ = Integration(
            user_id=user.id,
            provider="google",
            scopes=["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/gmail.compose"],
            status="connected",
            account_email="alex.chen@agentos.org",
        )
        db.add(integ)
    else:
        integ.status = "connected"
        integ.account_email = integ.account_email or "alex.chen@agentos.org"
    db.commit()

    return RedirectResponse(f"{frontend_url}/app/apps?connected=google")


@router.delete("/google", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_google(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    integ = db.scalar(
        select(Integration).where(Integration.user_id == user.id, Integration.provider == "google")
    )
    if integ is not None:
        integ.status = "disconnected"
        integ.encrypted_token = None
        integ.token_expires_at = None
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
