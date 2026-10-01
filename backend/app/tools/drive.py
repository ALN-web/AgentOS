"""Google Drive tools, #39.

With a connected Google account (`ctx.google`), every tool calls the real API and
`verify` re-reads the result from Google independently. Simulated versions
return a clearly marked simulation: `simulated=True`, and the evidence carries no link.
"""

import uuid
from typing import Any

from pydantic import BaseModel

from app.domain import RiskLevel
from app.integrations.google import GoogleError
from app.tools.base import Tool, ToolContext, ToolResult


def _simulated_evidence(ev: dict[str, Any]) -> list[dict[str, Any]]:
    return [{**ev, "source": "simulated", "label": f"Simulated: {ev['label']}", "url": None}]


class DriveCreateDocumentInput(BaseModel):
    title: str
    content: str


class DriveCreateDocumentTool(Tool):
    name = "drive.create_document"
    capability = "document"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/drive.file",)
    description = "Create a document in Google Drive."
    risk = RiskLevel.MEDIUM
    output_fields = ("file_id", "html_link", "title", "mime_type")
    supports_idempotency = True
    input_model = DriveCreateDocumentInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        title = args["title"]
        content = args["content"]

        if ctx.idempotency_key:
            q = f"appProperties has {{ key='agentos_key' and value='{ctx.idempotency_key}' }} and trashed=false"
            existing = ctx.google.search_drive(q)
            if existing:
                f = existing[0]
                return ToolResult(
                    status="success", tool=self.name,
                    output={
                        "file_id": f["id"], "html_link": f.get("webViewLink", ""),
                        "title": f.get("name", title), "mime_type": f.get("mimeType", "")
                    },
                    evidence=[{"type": "drive_document", "source": "google_drive", "label": f"Open '{f.get('name', title)}' in Google Drive",
                               "url": f.get("webViewLink"), "reference_id": f["id"]}],
                )

        metadata = {
            "name": title,
            "mimeType": "application/vnd.google-apps.document",
        }
        if ctx.idempotency_key:
            metadata["appProperties"] = {"agentos_key": ctx.idempotency_key}

        f = ctx.google.create_document(metadata, content)

        return ToolResult(
            status="success", tool=self.name,
            output={
                "file_id": f["id"], "html_link": f.get("webViewLink", ""),
                "title": f.get("name", title), "mime_type": f.get("mimeType", "")
            },
            evidence=[{"type": "drive_document", "source": "google_drive", "label": f"Open '{title}' in Google Drive",
                       "url": f.get("webViewLink"), "reference_id": f["id"]}],
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        try:
            f = ctx.google.get_file(result.output["file_id"])
            ok = f.get("id") == result.output["file_id"] and not f.get("trashed")
        except GoogleError as err:
            if err.error_class == "not_found":
                ok = False
            else:
                raise
        return {"verified": ok, "detail": "Re-read the file from Google Drive." if ok else "The file is missing or trashed.", "method": "re-fetched file by id"}


class SimulatedDriveCreateDocumentTool(Tool):
    name = "drive.create_document"
    capability = "document"
    integration = "google"
    kind = "simulated"
    description = "Create a document in Google Drive."
    risk = RiskLevel.MEDIUM
    output_fields = ("file_id", "html_link", "title", "mime_type")
    supports_idempotency = True
    input_model = DriveCreateDocumentInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        title = args["title"]
        file_id = f"file_{uuid.uuid4().hex[:12]}"

        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={
                "file_id": file_id, "html_link": "", "title": title, "mime_type": "application/vnd.google-apps.document"
            },
            evidence=_simulated_evidence({"type": "drive_document", "label": f"Open '{title}' in Google Drive", "reference_id": file_id}),
        )

    def verify(self, ctx: ToolContext, result: ToolResult) -> dict[str, Any]:
        return {"verified": False, "simulated": True, "detail": "Simulated; nothing to re-read."}


class DriveGetFileInput(BaseModel):
    file_id: str


class DriveGetFileTool(Tool):
    name = "drive.get_file"
    capability = "research"
    integration = "google"
    kind = "real"
    required_scopes = ("https://www.googleapis.com/auth/drive.file",)
    description = "Get details of a Google Drive file by ID."
    risk = RiskLevel.LOW
    output_fields = ("file_id", "html_link", "title", "mime_type", "trashed")
    supports_idempotency = True
    input_model = DriveGetFileInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        file_id = args["file_id"]
        try:
            f = ctx.google.get_file(file_id)
        except GoogleError as err:
            if err.error_class == "not_found":
                return ToolResult(
                    status="failed", tool=self.name, error_class="not_found",
                    output={"file_id": file_id}
                )
            raise
        
        return ToolResult(
            status="success", tool=self.name,
            output={
                "file_id": f["id"], "html_link": f.get("webViewLink", ""),
                "title": f.get("name", ""), "mime_type": f.get("mimeType", ""),
                "trashed": f.get("trashed", False)
            },
            evidence=[{"type": "drive_document", "source": "google_drive", "label": f"Open '{f.get('name', '')}' in Google Drive",
                       "url": f.get("webViewLink"), "reference_id": f["id"]}],
        )


class SimulatedDriveGetFileTool(Tool):
    name = "drive.get_file"
    capability = "research"
    integration = "google"
    kind = "simulated"
    description = "Get details of a Google Drive file by ID."
    risk = RiskLevel.LOW
    output_fields = ("file_id", "html_link", "title", "mime_type", "trashed")
    supports_idempotency = True
    input_model = DriveGetFileInput

    def execute(self, ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
        file_id = args["file_id"]
        return ToolResult(
            status="success", tool=self.name, simulated=True,
            output={
                "file_id": file_id, "html_link": "", "title": "Simulated Document", "mime_type": "application/vnd.google-apps.document", "trashed": False
            },
            evidence=_simulated_evidence({"type": "drive_document", "label": "Open 'Simulated Document' in Google Drive", "reference_id": file_id}),
        )


DRIVE_TOOLS: tuple[Tool, ...] = (
    DriveCreateDocumentTool(),
    SimulatedDriveCreateDocumentTool(),
    DriveGetFileTool(),
    SimulatedDriveGetFileTool(),
)
