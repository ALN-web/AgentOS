"""Fake tools for testing idempotency, partial failure, and data passing."""

from typing import Any, Callable

from app.domain import RiskLevel
from app.tools.base import Tool, ToolContext, ToolResult


class FakeTool(Tool):
    """A configurable tool for testing edge cases, failures, and idempotency."""

    def __init__(
        self,
        name: str,
        capability: str = "execution",
        risk: RiskLevel = RiskLevel.LOW,
        output_fields: tuple[str, ...] = ("result", "id"),
        supports_idempotency: bool = True,
        side_effect: Callable[[ToolContext, dict[str, Any]], ToolResult] | None = None,
    ):
        self.name = name
        self.capability = capability
        self.risk = risk
        self.output_fields = output_fields
        self.supports_idempotency = supports_idempotency
        self.side_effect = side_effect
        self.call_count = 0
        self.calls: list[tuple[ToolContext, dict[str, Any]]] = []
        self.fail_times = 0

    def set_fail_times(self, n: int) -> None:
        self.fail_times = n

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        self.call_count += 1
        self.calls.append((ctx, args))

        if self.fail_times > 0:
            self.fail_times -= 1
            return ToolResult(
                status="failed",
                tool=self.name,
                error_class="simulated_error",
                output={},
            )

        if self.side_effect:
            return self.side_effect(ctx, args)

        return ToolResult(
            status="success",
            tool=self.name,
            output={
                "result": f"ok_{self.name}",
                "id": f"id_{self.call_count}",
                "echo": args,
            },
            evidence=[{
                "type": "fake_evidence",
                "source": "fake",
                "label": f"Executed {self.name}",
                "reference_id": f"ref_{self.call_count}",
            }],
        )
