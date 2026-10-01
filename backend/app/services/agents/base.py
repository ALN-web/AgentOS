from dataclasses import dataclass
from typing import Any, Callable, Protocol
from sqlalchemy.orm import Session
from app.db.models import Mission, Task, User
from app.tools.base import ToolResult

@dataclass
class AgentContext:
    db: Session
    user: User
    mission: Mission
    task: Task
    resolved_inputs: dict[str, Any]
    execute_tool: Callable[[str, dict[str, Any]], ToolResult]

class Agent(Protocol):
    id: str

    def can_handle(self, task: Task) -> bool:
        ...

    def run(self, ctx: AgentContext) -> ToolResult:
        ...
