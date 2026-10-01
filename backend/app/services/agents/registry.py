from app.capabilities import CAPABILITY_BY_ID, TASK_TYPES
from app.db.models import Task
from .base import Agent
from .impl import (
    PlannerAgent, ResearchAgent, BrowserAgent, ExecutionAgent,
    VerificationAgent, RecoveryAgent, CriticAgent, ApprovalAgent
)

class AgentRegistry:
    def __init__(self):
        self._agents: dict[str, Agent] = {
            "planner": PlannerAgent(),
            "research": ResearchAgent(),
            "browser": BrowserAgent(),
            "execution": ExecutionAgent(),
            "verification": VerificationAgent(),
            "recovery": RecoveryAgent(),
            "critic": CriticAgent(),
            "approval": ApprovalAgent(),
        }

    def get_agent(self, agent_id: str) -> Agent | None:
        return self._agents.get(agent_id)

    def resolve_agent_for_task(self, task: Task) -> Agent | None:
        cap_id = task.capability or TASK_TYPES.get(task.type or "")
        if cap_id:
            cap = CAPABILITY_BY_ID.get(cap_id)
            if cap:
                return self.get_agent(cap.agent)
        
        # If no known capability match, try to use task.agent if it exists and is registered.
        if task.agent and self.get_agent(task.agent):
            return self.get_agent(task.agent)
            
        return None

_registry = AgentRegistry()

def get_agent(agent_id: str) -> Agent | None:
    return _registry.get_agent(agent_id)

def resolve_agent_for_task(task: Task) -> Agent | None:
    return _registry.resolve_agent_for_task(task)
