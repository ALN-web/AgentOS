"""Google connection (#6): server-side OAuth with PKCE. Tokens never leave the server."""

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.models import Integration, User
from app.db.session import get_db
from app.integrations.google import GoogleConnector, GoogleError

router = APIRouter(prefix="/integrations", tags=["integrations"])
log = get_logger("integrations")


class IntegrationOut(BaseModel):
    provider: str
    status: str  # connected | not_connected
    scopes: list[str]
    account_email: str | None


class ConnectOut(BaseModel):
    authorization_url: str


def google_connector(request: Request) -> GoogleConnector:
    return request.app.state.google


@router.get("", response_model=list[IntegrationOut])
def list_integrations(db: Session = Depends(get_db), user: User = Depends(current_user)):
    g = db.scalar(select(Integration).where(Integration.user_id == user.id, Integration.provider == "google"))
    connected = g is not None and g.status == "connected" and g.encrypted_token is not None
    return [
        IntegrationOut(
            provider="google",
            status="connected" if connected else "not_connected",
            scopes=list(g.scopes or []) if connected else [],
            account_email=g.account_email if connected else None,
        )
    ]


@router.post("/google/connect", response_model=ConnectOut)
def connect_google(user: User = Depends(current_user), google: GoogleConnector = Depends(google_connector)):
    if not google.configured:
        raise AppError("google_not_configured", google.problem or "Google is not configured.", status_code=503)
    return ConnectOut(authorization_url=google.authorization_url(user))


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    google: GoogleConnector = Depends(google_connector),
):
    def back(**params: str) -> RedirectResponse:
        return RedirectResponse(f"{google.settings.frontend_url}/app/apps?{urlencode(params)}", status_code=303)

    if error:
        # Only our own codes go back to the browser, never Google's free text.
        return back(error="access_denied" if error == "access_denied" else "google_error")
    if not code or not state:
        return back(error="invalid_request")
    try:
        google.complete(db, user, code, state)
    except GoogleError as err:
        log.warning("Google connection failed: %s", err.error_class)
        return back(error=err.error_class)
    return back(connected="google")


@router.delete("/google", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_google(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
    google: GoogleConnector = Depends(google_connector),
):
    google.disconnect(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
