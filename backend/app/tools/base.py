"""Base classes for AgentOS tools."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.domain import RiskLevel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ToolResult:
    """Every tool execution returns this structured result."""

    status: str  # "success" | "failed"
    tool: str
    output: dict[str, Any] = field(default_factory=dict)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    timestamp: datetime = field(default_factory=utcnow)
    verification: dict[str, Any] | None = None
    error_class: str | None = None


@dataclass
class ToolContext:
    """Context provided to a tool during execution. Never contains raw user credentials."""

    user_id: str
    mission_id: str
    task_id: str
    db: Session | None = None
    allowed_scopes: frozenset[str] = field(default_factory=frozenset)
    idempotency_key: str | None = None
    # The user's preferences (timezone, working hours, signature, ...), already
    # applied to the arguments by the runner; available for tools that need more.
    preferences: dict | None = None


class Tool(ABC):
    """Abstract base class for all tools."""

    name: str
    capability: str
    description: str = ""
    risk: RiskLevel = RiskLevel.LOW
    required_scopes: tuple[str, ...] = ()
    integration: str | None = None
    output_fields: tuple[str, ...] = ()
    supports_idempotency: bool = False

    @abstractmethod
    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        """Run the tool with the given arguments."""
        ...

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        """Verify the execution result independently."""
        return {"verified": result.status == "success"}

    def classify(self, exc: Exception) -> str:
        """Map an unhandled exception to a standardized failure class."""
        return "service_unavailable"
