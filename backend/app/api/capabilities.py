"""GET /api/capabilities: what AgentOS can do, and what can run for real today."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.capabilities import CAPABILITIES, live_tools

router = APIRouter(tags=["capabilities"])


class CapabilityOut(BaseModel):
    id: str
    name: str
    agent: str
    external: bool
    risk: str
    requires_approval: bool
    tool_bindings: list[str]
    live_tools: list[str]
    mode: str  # "live" when a real tool is available, otherwise "simulated"


@router.get("/capabilities", response_model=list[CapabilityOut])
def list_capabilities() -> list[CapabilityOut]:
    out = []
    for c in CAPABILITIES:
        live = live_tools(c)
        out.append(
            CapabilityOut(
                id=c.id,
                name=c.name,
                agent=c.agent,
                external=c.external,
                risk=c.risk.value,
                requires_approval=c.external or c.risk.value in ("HIGH", "CRITICAL"),
                tool_bindings=list(c.tool_bindings),
                live_tools=live,
                mode="live" if live else "simulated",
            )
        )
    return out
