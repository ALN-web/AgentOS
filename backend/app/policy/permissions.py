"""Per-user app permissions as seen by the policy engine (used by Priority 2, #6).

Every real tool call asks `check_action` first:
- off     -> refused; the runtime classifies it as `permission_denied` and recovers or re-plans
- ask     -> runs only after human approval
- allowed -> runs automatically (only possible for LOW/MEDIUM risk)
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AppPermission, User
from app.integrations.catalog import ACTION_BY_ID, ACTION_TO_APP, default_mode, max_mode


@dataclass(frozen=True)
class PermissionDecision:
    action_id: str
    mode: str  # allowed | ask | off
    permitted: bool
    requires_approval: bool
    reason: str


def check_action(db: Session, user: User, action_id: str) -> PermissionDecision:
    action = ACTION_BY_ID.get(action_id)
    if action is None:
        # Unknown actions are never run.
        return PermissionDecision(action_id, "off", False, False, "Unknown action.")
    app = ACTION_TO_APP[action_id]
    row = db.scalar(
        select(AppPermission).where(
            AppPermission.user_id == user.id, AppPermission.app_id == app.id, AppPermission.action_id == action_id
        )
    )
    mode = max_mode(action.risk, row.mode if row else default_mode(action.risk))
    if mode == "off":
        return PermissionDecision(action_id, mode, False, False, f"You turned off '{action.label}' for {app.name}.")
    if mode == "ask":
        return PermissionDecision(action_id, mode, True, True, f"'{action.label}' needs your approval.")
    return PermissionDecision(action_id, mode, True, False, f"'{action.label}' is allowed to run automatically.")
