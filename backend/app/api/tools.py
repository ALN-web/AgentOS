"""GET /api/tools: the tools the runtime knows, and whether each runs for real here."""

from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel

from app.db.models import User
from app.api.deps import current_user
from app.db.session import get_db
from sqlalchemy.orm import Session
from app.tools.registry import get_all_tools, resolve

router = APIRouter(tags=["tools"])


class ToolOut(BaseModel):
    name: str
    capability: str
    kind: str
    risk: str
    integration: str | None
    required_scopes: list[str]
    output_fields: list[str]
    available: bool
    reason: str | None


@router.get("/tools", response_model=list[ToolOut])
def list_tools(db: Session = Depends(get_db), user: User = Depends(current_user)) -> list[ToolOut]:
    tools = get_all_tools()
    out = []
    for t in sorted(tools.values(), key=lambda t: t.name):
        res = resolve(t.name, db, user)
        out.append(ToolOut(
            name=t.name,
            capability=t.capability,
            kind=t.kind,
            risk=str(t.risk.value if hasattr(t.risk, "value") else t.risk),
            integration=t.integration,
            required_scopes=list(t.required_scopes),
            output_fields=list(t.output_fields),
            available=res.available,
            reason=res.reason,
        ))
    return out
