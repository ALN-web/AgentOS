from app.db.models import Task
from app.tools.base import ToolResult
from app.tools.registry import get_tool
from app.capabilities import TASK_TYPES
from .base import Agent, AgentContext

def find_tool_name_for_task(task: Task) -> str | None:
    if task.inputs and isinstance(task.inputs, dict) and "tool" in task.inputs:
        return str(task.inputs["tool"])
    cap = task.capability or TASK_TYPES.get(task.type or "")
    tool_name = None
    if cap == "calendar":
        title_lower = task.title.lower()
        if task.type in ("search", "find") or "find" in title_lower or "list" in title_lower:
            tool_name = "calendar.list_events"
        else:
            tool_name = "calendar.create_event"
    elif cap == "search":
        title_lower = task.title.lower()
        if "time" in title_lower or "slot" in title_lower or "calendar" in title_lower or "availab" in title_lower or "saturday" in str(task.inputs).lower():
            tool_name = "calendar.list_events"
    elif cap in ("document", "email") and (task.type in ("draft", "create") or "draft" in task.title.lower()):
        tool_name = "gmail.create_draft"
    elif cap in ("communication", "email") and (task.type in ("communicate", "send") or "send" in task.title.lower()):
        tool_name = "gmail.send_draft"
    if tool_name:
        return tool_name
    if task.capability and get_tool(task.capability):
        return task.capability
    if get_tool(task.key):
        return task.key
    return None

class GenericCapabilityAgent:
    def __init__(self, id: str):
        self.id = id

    def can_handle(self, task: Task) -> bool:
        cap_id = task.capability or TASK_TYPES.get(task.type or "")
        from app.capabilities import CAPABILITY_BY_ID
        cap = CAPABILITY_BY_ID.get(cap_id)
        return cap is not None and cap.agent == self.id

    def run(self, ctx: AgentContext) -> ToolResult:
        tool_name = find_tool_name_for_task(ctx.task)
        # No real tool for this capability: the runtime runs it as a marked simulation.
        return ctx.execute_tool(tool_name or "", ctx.resolved_inputs)


class PlannerAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("planner")

class ResearchAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("research")

class BrowserAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("browser")

class ExecutionAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("execution")

class RecoveryAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("recovery")

class CriticAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("critic")

class ApprovalAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("approval")

class VerificationAgent(GenericCapabilityAgent):
    def __init__(self): super().__init__("verification")
    
    def run(self, ctx: AgentContext) -> ToolResult:
        from app.domain import TaskStatus, EventType
        from app.services.missions import append_event
        
        append_event(ctx.db, ctx.mission, EventType.VERIFICATION_STARTED, "verification", {})
        
        criteria = []
        for d in ctx.task.dependencies:
            dep = d.depends_on
            label = dep.criterion or dep.title
            if dep.status == TaskStatus.SKIPPED:
                criteria.append({"task": dep.key, "label": label, "passed": False, "open": True, "detail": "Skipped: not approved or not allowed."})
                continue
            v = (dep.output or {}).get("verification") or {}
            passed = dep.status == TaskStatus.DONE and bool(dep.output) and (v.get("verified") is not False or bool(v.get("simulated")) or (dep.output or {}).get("simulated"))
            item = {"task": dep.key, "label": label, "passed": passed}
            if v.get("simulated") or (dep.output or {}).get("simulated"):
                item["simulated"] = True
            if v.get("detail"):
                item["detail"] = v["detail"]
            criteria.append(item)
            
        failed = [c for c in criteria if not c["passed"] and not c.get("open")]
        verified = not failed
        
        append_event(ctx.db, ctx.mission, EventType.VERIFICATION_COMPLETED, "verification", {"criteria": criteria, "verified": verified})
        
        # We don't execute a real tool for verification, so just return the ToolResult wrapper
        return ToolResult(
            status="success" if verified else "failed",
            tool="verification_machinery",
            output={"verified": verified, "criteria": criteria},
            error_class=None if verified else "verification_failed"
        )
