"""Connected apps: catalogue status, per-user permissions, disconnect and activity."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AppPermission, Evidence, Integration, Mission, ToolExecution, User
from app.integrations.catalog import APP_BY_ID, APPS, AppDef, default_mode, max_mode
from app.tools.registry import registered_tools

MODES = ("allowed", "ask", "off")


def _app(app_id: str) -> AppDef:
    app = APP_BY_ID.get(app_id)
    if app is None:
        raise AppError("app_not_found", f"App '{app_id}' not found.", status_code=404)
    return app


def _integration(db: Session, user: User, provider: str | None) -> Integration | None:
    if provider is None:
        return None
    return db.scalar(select(Integration).where(Integration.user_id == user.id, Integration.provider == provider))


def _modes(db: Session, user: User, app: AppDef) -> dict[str, str]:
    stored = {
        p.action_id: p.mode
        for p in db.scalars(select(AppPermission).where(AppPermission.user_id == user.id, AppPermission.app_id == app.id))
    }
    # Stored values are clamped too, so a tampered row can never unlock a HIGH action.
    return {a.id: max_mode(a.risk, stored.get(a.id, default_mode(a.risk))) for a in app.actions}


def _has_required_scopes(granted_scopes: list[str], app_scopes: tuple[str, ...]) -> bool:
    if not app_scopes:
        return True
    granted_norm = {s.split("/")[-1] for s in granted_scopes}
    return all(s.split("/")[-1] in granted_norm for s in app_scopes)


def app_status(db: Session, user: User, app: AppDef) -> tuple[str, Integration | None]:
    """connected: a real tool exists and the account is connected; available: a real tool
    exists but the account is not connected; demo: simulated in Demo Mode; else coming_soon."""
    has_real_tool = any(a.id in registered_tools() for a in app.actions)
    integ = _integration(db, user, app.integration)
    if integ is not None and integ.status == "needs_reconnect":
        scopes = integ.scopes or []
        if (has_real_tool or app.integration == "google") and (not scopes or _has_required_scopes(scopes, app.scopes)):
            return "needs_reconnect", integ
    connected = integ is not None and integ.status == "connected"
    if connected and integ.scopes and app.scopes:
        if not _has_required_scopes(integ.scopes, app.scopes):
            connected = False
    if has_real_tool and connected:
        return "connected", integ
    if has_real_tool:
        return "available", None
    return ("demo" if app.in_demo else "coming_soon"), None


def serialise(db: Session, user: User, app: AppDef) -> dict:
    status, integ = app_status(db, user, app)
    modes = _modes(db, user, app)
    live = registered_tools()
    return {
        "id": app.id,
        "name": app.name,
        "provider": app.provider,
        "category": app.category,
        "icon": app.icon,
        "description": app.description,
        "disconnect_warning": app.disconnect_warning,
        "status": status,
        "account_email": integ.account_email if integ else None,
        "granted_scopes": list(integ.scopes or []) if integ else [],
        "actions": [
            {
                "id": a.id,
                "label": a.label,
                "risk": a.risk.value,
                "capability": a.capability,
                "mode": modes[a.id],
                "live": a.id in live,
            }
            for a in app.actions
        ],
    }


def list_apps(db: Session, user: User) -> list[dict]:
    return [serialise(db, user, app) for app in APPS]


def update_permissions(db: Session, user: User, app_id: str, changes: dict[str, str]) -> dict:
    app = _app(app_id)
    by_id = {a.id: a for a in app.actions}
    # Validate everything before changing anything.
    for action_id, mode in changes.items():
        action = by_id.get(action_id)
        if action is None:
            raise AppError("action_not_found", f"Action '{action_id}' is not part of '{app_id}'.", status_code=422)
        if mode not in MODES:
            raise AppError("invalid_mode", f"Mode must be one of: {', '.join(MODES)}.", status_code=422)
        if mode == "allowed" and action.risk.value in ("HIGH", "CRITICAL"):
            raise AppError(
                "permission_not_allowed",
                f"'{action_id}' is {action.risk.value} risk and cannot run without approval. Use 'ask' or 'off'.",
                status_code=422,
            )
    existing = {
        p.action_id: p
        for p in db.scalars(select(AppPermission).where(AppPermission.user_id == user.id, AppPermission.app_id == app_id))
    }
    for action_id, mode in changes.items():
        row = existing.get(action_id)
        if row is None:
            db.add(AppPermission(user_id=user.id, app_id=app_id, action_id=action_id, mode=mode))
        else:
            row.mode = mode
    db.commit()
    return serialise(db, user, app)


def disconnect(db: Session, user: User, app_id: str, google=None) -> dict:
    """Idempotent. Apps that share a provider (all Google apps) share one connection."""
    app = _app(app_id)
    integ = _integration(db, user, app.integration)
    was_connected = integ is not None and integ.status in ("connected", "needs_reconnect")
    if app.integration == "google" and google is not None:
        google.disconnect(db, user)
    elif integ is not None:
        integ.status = "disconnected"
        integ.encrypted_token = None
        integ.token_expires_at = None
        integ.scopes = []
        integ.account_email = None
        db.commit()
    affected = [a.id for a in APPS if app.integration and a.integration == app.integration]
    return {"id": app_id, "disconnected": was_connected, "affected_apps": affected}


def activity(db: Session, user: User, app_id: str, limit: int) -> list[dict]:
    """Real tool executions in this app, newest first. Tool inputs are never returned."""
    app = _app(app_id)
    action_ids = [a.id for a in app.actions]
    rows = db.execute(
        select(ToolExecution, Mission.goal)
        .join(Mission, Mission.id == ToolExecution.mission_id)
        .where(Mission.user_id == user.id, ToolExecution.tool_name.in_(action_ids))
        .order_by(ToolExecution.started_at.desc())
        .limit(limit)
    ).all()
    out = []
    for execution, goal in rows:
        evidence = db.scalars(select(Evidence).where(Evidence.tool_execution_id == execution.id)).all()
        out.append(
            {
                "mission_id": execution.mission_id,
                "goal": goal,
                "action": execution.tool_name,
                "status": execution.status,
                "created_at": execution.started_at,
                "evidence": [{"label": e.label, "url": e.url} for e in evidence],
            }
        )
    return out
