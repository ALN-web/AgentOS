"""Google Forms tools, #40.

With a connected Google account (`ctx.google`), every tool calls the real API and
`verify` re-reads the result from Google independently. Simulated versions
return a clearly marked simulation: `simulated=True`, and the evidence carries no link.
"""

import uuid
from typing import Any, Literal

from pydantic import BaseModel

from app.domain import RiskLevel
from app.integrations.google import GoogleError
from app.tools.base import Tool, ToolContext, ToolResult


def _simulated_evidence(ev: dict[str, Any]) -> list[dict[str, Any]]:
    return [{**ev, "source": "simulated", "label": f"Simulated: {ev['label']}", "url": None}]


class FormsQuestionInput(BaseModel):
    title: str
    type: Literal["text", "paragraph", "choice"]
    options: list[str] | None = None
    required: bool | None = None


class FormsCreateFormInput(BaseModel):
    title: str
    description: str
    questions: list[FormsQuestionInput]


class FormsCreateFormTool(Tool):
    name = "forms.create_form"
    capability = "document"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/forms.body",)
    description = "Create a registration form or survey."
    risk = RiskLevel.MEDIUM
    output_fields = ("form_id", "responder_url", "edit_url", "title", "question_count")
    supports_idempotency = True
    input_model = FormsCreateFormInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        title = args["title"]
        description = args["description"]
        questions = args["questions"]
        question_count = len(questions)

        if ctx.idempotency_key:
            q = f"appProperties has {{ key='agentos_key' and value='{ctx.idempotency_key}' }} and trashed=false"
            existing = ctx.google.search_drive(q)
            if existing:
                f_drive = existing[0]
                form_id = f_drive["id"]
                try:
                    f = ctx.google.get_form(form_id)
                    return ToolResult(
                        status="success", tool=self.name,
                        output={
                            "form_id": form_id, "responder_url": f.get("responderUri", ""),
                            "edit_url": f"https://docs.google.com/forms/d/{form_id}/edit",
                            "title": f.get("info", {}).get("title", title),
                            "question_count": len(f.get("items", []))
                        },
                        evidence=[{"type": "google_form", "source": "google_forms", "label": "Open the registration form",
                                   "url": f.get("responderUri"), "reference_id": form_id}],
                    )
                except GoogleError as err:
                    if err.error_class != "not_found":
                        raise

        # 1. Create form
        body = {
            "info": {
                "title": title,
                "documentTitle": title
            }
        }
        f = ctx.google.create_form(body)
        form_id = f["formId"]

        # Tag it with idempotency key via Drive API
        if ctx.idempotency_key:
            ctx.google.update_file_metadata(form_id, {"appProperties": {"agentos_key": ctx.idempotency_key}})

        # 2. Batch update (description and questions)
        requests = []
        if description:
            requests.append({
                "updateFormInfo": {
                    "info": {
                        "description": description
                    },
                    "updateMask": "description"
                }
            })

        for i, q in enumerate(questions):
            question_dict: dict[str, Any] = {"required": bool(q.get("required"))}
            q_type = q["type"]
            if q_type == "text":
                question_dict["textQuestion"] = {"paragraph": False}
            elif q_type == "paragraph":
                question_dict["textQuestion"] = {"paragraph": True}
            elif q_type == "choice":
                question_dict["choiceQuestion"] = {
                    "type": "RADIO",
                    "options": [{"value": opt} for opt in (q.get("options") or [])]
                }

            requests.append({
                "createItem": {
                    "item": {
                        "title": q["title"],
                        "questionItem": {
                            "question": question_dict
                        }
                    },
                    "location": {
                        "index": i
                    }
                }
            })

        if requests:
            ctx.google.update_form(form_id, {"requests": requests})

        responder_url = f.get("responderUri", "")

        return ToolResult(
            status="success", tool=self.name,
            output={
                "form_id": form_id, "responder_url": responder_url,
                "edit_url": f"https://docs.google.com/forms/d/{form_id}/edit",
                "title": title, "question_count": question_count
            },
            evidence=[{"type": "google_form", "source": "google_forms", "label": "Open the registration form",
                       "url": responder_url, "reference_id": form_id}],
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        try:
            f = ctx.google.get_form(result.output["form_id"])
            expected_count = result.output["question_count"]
            actual_count = len([i for i in f.get("items", []) if "questionItem" in i])
            ok = (actual_count == expected_count)
        except GoogleError as err:
            if err.error_class == "not_found":
                ok = False
            else:
                raise
        return {"verified": ok, "detail": "Re-read the form and matched question count." if ok else "The form is missing or question count mismatch.", "method": "re-fetched form by id"}


class SimulatedFormsCreateFormTool(Tool):
    name = "forms.create_form"
    capability = "document"
    integration = "google"
    kind = "simulated"
    description = "Create a registration form or survey."
    risk = RiskLevel.MEDIUM
    output_fields = ("form_id", "responder_url", "edit_url", "title", "question_count")
    supports_idempotency = True
    input_model = FormsCreateFormInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        title = args["title"]
        question_count = len(args["questions"])
        form_id = f"form_{uuid.uuid4().hex[:12]}"

        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={
                "form_id": form_id, "responder_url": f"https://docs.google.com/forms/d/e/{form_id}/viewform",
                "edit_url": f"https://docs.google.com/forms/d/{form_id}/edit",
                "title": title, "question_count": question_count
            },
            evidence=_simulated_evidence({"type": "google_form", "label": "Open the registration form", "reference_id": form_id}),
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        return {"verified": False, "simulated": True, "detail": "Simulated; nothing to re-read."}


class FormsGetFormInput(BaseModel):
    form_id: str


class FormsGetFormTool(Tool):
    name = "forms.get_form"
    capability = "research"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/forms.body",)
    description = "Get details of a Google Form by ID."
    risk = RiskLevel.LOW
    output_fields = ("form_id", "title", "question_count", "responder_url")
    supports_idempotency = True
    input_model = FormsGetFormInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        form_id = args["form_id"]
        try:
            f = ctx.google.get_form(form_id)
        except GoogleError as err:
            if err.error_class == "not_found":
                return ToolResult(
                    status="failed", tool=self.name, error_class="not_found",
                    output={"form_id": form_id}
                )
            raise

        responder_url = f.get("responderUri", "")
        title = f.get("info", {}).get("title", "")
        question_count = len([i for i in f.get("items", []) if "questionItem" in i])
        return ToolResult(
            status="success", tool=self.name,
            output={
                "form_id": form_id, "title": title,
                "question_count": question_count, "responder_url": responder_url
            },
            evidence=[{"type": "google_form", "source": "google_forms", "label": "Open the registration form",
                       "url": responder_url, "reference_id": form_id}],
        )


class SimulatedFormsGetFormTool(Tool):
    name = "forms.get_form"
    capability = "research"
    integration = "google"
    kind = "simulated"
    description = "Get details of a Google Form by ID."
    risk = RiskLevel.LOW
    output_fields = ("form_id", "title", "question_count", "responder_url")
    supports_idempotency = True
    input_model = FormsGetFormInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        form_id = args["form_id"]
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={
                "form_id": form_id, "title": "Simulated Form", "question_count": 0,
                "responder_url": f"https://docs.google.com/forms/d/e/{form_id}/viewform"
            },
            evidence=_simulated_evidence({"type": "google_form", "label": "Open the registration form", "reference_id": form_id}),
        )


FORMS_TOOLS: tuple[Tool, ...] = (
    FormsCreateFormTool(),
    SimulatedFormsCreateFormTool(),
    FormsGetFormTool(),
    SimulatedFormsGetFormTool(),
)