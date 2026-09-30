"""Centralized Policy Engine.

Every real tool execution must pass through this decision point.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import User
from app.tools.base import Tool, RiskLevel
from app.integrations.catalog import ACTION_BY_ID
from app.policy.permissions import check_action


@dataclass(frozen=True)
class PolicyDecision:
    permitted: bool
    requires_approval: bool
    reason: str | None = None
    error_class: str | None = None


def decide(db: Session, user: User, is_live: bool, tool: Tool, is_gated: bool, inputs: dict[str, Any]) -> PolicyDecision:
    """Make the authoritative policy decision for a tool execution."""
    
    # 1. Enforce Live vs Demo boundary
    if is_live and tool.kind == "simulated":
        return PolicyDecision(
            permitted=False, 
            requires_approval=False, 
            reason=f"Cannot run simulated tool '{tool.name}' in Live Mode.",
            error_class="permission_denied"
        )
        
    # 2. Input Validation
    if hasattr(tool, "input_model") and tool.input_model:
        try:
            tool.input_model(**inputs)
        except Exception as exc:
            return PolicyDecision(
                permitted=False,
                requires_approval=False,
                reason=f"Input validation failed: {exc}",
                error_class="validation_error"
            )

    # 3. Check per-app permissions (Issue #11)
    action_id = tool.action_id or tool.name
    permission = check_action(db, user, action_id) if action_id in ACTION_BY_ID else None
    
    if permission is not None and not permission.permitted:
        return PolicyDecision(
            permitted=False, 
            requires_approval=False, 
            reason=permission.reason,
            error_class="permission_denied"
        )
        
    if permission is None and tool.risk == RiskLevel.CRITICAL:
        return PolicyDecision(
            permitted=False, 
            requires_approval=False, 
            reason=f"'{tool.name}' is a critical action and is never run automatically.",
            error_class="permission_denied"
        )
        
    # 4. Check Approval Gateway
    needs_approval = is_gated or tool.risk == RiskLevel.HIGH or bool(permission and permission.requires_approval)
    
    return PolicyDecision(permitted=True, requires_approval=needs_approval)
