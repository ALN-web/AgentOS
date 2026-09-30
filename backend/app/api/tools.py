"""GET /api/tools: the tools the runtime knows, and whether each runs for real here."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services.runner import DEFAULT_TOOLS
from app.tools.registry import get_all_tools

router = APIRouter(tags=["tools"])


class ToolOut(BaseModel):
    name: str
    capability: str
    risk: str
    available: bool  # False: the step runs as a marked simulation


@router.get("/tools", response_model=list[ToolOut])
def list_tools(request: Request) -> list[ToolOut]:
    google_ready = request.app.state.google.configured
    tools = {**DEFAULT_TOOLS, **get_all_tools()}
    return [
        ToolOut(
            name=t.name,
            capability=t.capability,
            risk=str(t.risk),
            available=google_ready if t.integration == "google" else True,
        )
        for t in sorted(tools.values(), key=lambda t: t.name)
    ]
