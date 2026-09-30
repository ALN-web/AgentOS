"""Liveness and capability reporting.

The frontend will use `live_mode.available` to decide whether a Live Mode
option may be shown at all. It stays false until real execution works.
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import text

from app import __version__
from app.core.config import Settings

router = APIRouter(tags=["health"])


class LiveModeStatus(BaseModel):
    available: bool
    reason: str


class Health(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    database: str
    live_mode: LiveModeStatus


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _database_ok(request: Request) -> bool:
    try:
        with request.app.state.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@router.get("/health", response_model=Health)
def health(request: Request, settings: Settings = Depends(_settings)) -> Health:
    return Health(
        status="ok",
        service="agentos-backend",
        version=__version__,
        environment=settings.environment,
        database="ok" if _database_ok(request) else "unavailable",
        live_mode=LiveModeStatus(
            available=True,
            reason="Live execution is fully operational via SSE streams.",
        ),
    )
