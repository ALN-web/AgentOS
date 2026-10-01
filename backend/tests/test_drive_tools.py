"""Focused unit tests for Google Drive tools (Issue #39).

Uses a self-contained MockGoogleConnector so tests run with no live credentials.
The mock dispatches on URL fragments/method to simulate every required error path.
"""
import pytest
import httpx
from app.db.models import Integration
from app.tools.base import ToolContext, ToolResult
from app.tools.drive import (
    DriveCreateDocumentTool,
    DriveGetFileTool,
    SimulatedDriveCreateDocumentTool,
    SimulatedDriveGetFileTool,
)
from app.integrations.google import GoogleClient, GoogleError


# ──────────────────────────────────────────────────────────────────────────────
# Mock transport
# ──────────────────────────────────────────────────────────────────────────────

_GOOD_FILE = {
    "id": "file-abc",
    "name": "My Doc",
    "webViewLink": "https://docs.google.com/document/d/file-abc/edit",
    "mimeType": "application/vnd.google-apps.document",
    "trashed": False,
}

_GOOD_SEARCH: dict = {"files": []}  # empty by default (no idempotent match)


class MockGoogleConnector:
    """Minimal connector whose http() returns a controllable mock client."""

    def __init__(self, responses: list):
        """responses: list of (method_prefix, url_fragment, status_code, body | exc).
        Matched in order; first match wins. If body is an exception it is raised.
        Remaining unmatched calls fall through to a 500.
        """
        self._queue = list(responses)

    def access_token(self, db, integ):
        return "fake-tok"

    def http(self):
        queue = self._queue

        class _Client:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                pass

            def request(self, method, url, **kwargs):
                for i, (m, frag, code, body) in enumerate(queue):
                    if method.upper().startswith(m.upper()) and frag in url:
                        queue.pop(i)
                        if isinstance(body, Exception):
                            raise body
                        return _Res(code, body)
                # fallthrough → 500
                return _Res(500, {})

        class _Res:
            def __init__(self, status_code, data):
                self.status_code = status_code
                self._data = data
                self.content = b"x"

            def json(self):
                return self._data

        return _Client()


def _connector(*responses):
    return MockGoogleConnector(list(responses))


def _client(connector):
    integ = Integration(user_id=1, provider="google", account_email="t@x.com")

    class _DB:
        def flush(self): pass
        def commit(self): pass

    return GoogleClient(connector, _DB(), integ)


def _ctx(google_client, *, idempotency_key=None):
    return ToolContext(
        user_id=1, mission_id="m1", task_id="t1",
        google=google_client, idempotency_key=idempotency_key,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _create_responses(extra_code=None, extra_body=None):
    """Standard responses for a successful create: search (empty) + upload."""
    responses = [
        ("GET",  "/files",   200, {"files": []}),                    # search_drive
        ("POST", "/upload",  200, _GOOD_FILE),                       # create_document
        ("GET",  "/files/",  200, {**_GOOD_FILE}),                   # verify get_file
    ]
    if extra_code is not None:
        # Replace the POST response
        responses[1] = ("POST", "/upload", extra_code, extra_body or {})
    return responses


def _get_responses(code=200, body=None):
    return [("GET", "/files/", code, body or _GOOD_FILE)]


# ──────────────────────────────────────────────────────────────────────────────
# drive.create_document — success
# ──────────────────────────────────────────────────────────────────────────────

def test_create_document_success():
    conn = _connector(
        ("GET",  "/files",  200, {"files": []}),
        ("POST", "/upload", 200, _GOOD_FILE),
    )
    tool = DriveCreateDocumentTool()
    res = tool.execute(_ctx(_client(conn)), {"title": "My Doc", "content": "hello"})

    assert res.status == "success"
    assert res.output["file_id"] == "file-abc"
    assert res.output["title"] == "My Doc"
    assert res.output["html_link"] == _GOOD_FILE["webViewLink"]
    assert res.output["mime_type"] == "application/vnd.google-apps.document"
    assert len(res.evidence) == 1
    assert res.evidence[0]["url"] == _GOOD_FILE["webViewLink"]
    assert res.evidence[0]["reference_id"] == "file-abc"
    assert res.evidence[0]["source"] == "google_drive"


# ──────────────────────────────────────────────────────────────────────────────
# drive.create_document — error paths
# ──────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("code,expected_class", [
    (400, "validation_error"),
    (401, "authentication_failed"),
    (403, "permission_denied"),
    (429, "rate_limited"),
    (500, "service_unavailable"),
    (503, "service_unavailable"),
])
def test_create_document_http_errors(code, expected_class):
    conn = _connector(
        ("GET",  "/files",  200, {"files": []}),
        ("POST", "/upload", code, {"error": "invalid_grant"} if code == 401 else {}),
    )
    tool = DriveCreateDocumentTool()
    with pytest.raises(GoogleError) as exc:
        tool.execute(_ctx(_client(conn)), {"title": "T", "content": "c"})
    assert exc.value.error_class == expected_class


def test_create_document_timeout():
    conn = _connector(
        ("GET",  "/files",  200, {"files": []}),
        ("POST", "/upload", 0,   httpx.TimeoutException("timeout")),
    )
    tool = DriveCreateDocumentTool()
    with pytest.raises(GoogleError) as exc:
        tool.execute(_ctx(_client(conn)), {"title": "T", "content": "c"})
    assert exc.value.error_class == "timeout"


def test_create_document_network_error():
    conn = _connector(
        ("GET",  "/files",  200, {"files": []}),
        ("POST", "/upload", 0,   httpx.HTTPError("net")),
    )
    tool = DriveCreateDocumentTool()
    with pytest.raises(GoogleError) as exc:
        tool.execute(_ctx(_client(conn)), {"title": "T", "content": "c"})
    assert exc.value.error_class == "network_error"


# ──────────────────────────────────────────────────────────────────────────────
# drive.create_document — idempotency
# ──────────────────────────────────────────────────────────────────────────────

def test_create_document_idempotent_retry_returns_existing():
    """Second call with same idempotency_key returns existing file; no POST."""
    existing = {**_GOOD_FILE, "appProperties": {"agentos_key": "key-x"}}
    conn = _connector(
        ("GET", "/files", 200, {"files": [existing]}),
        # No POST should be reached
    )
    tool = DriveCreateDocumentTool()
    res = tool.execute(
        _ctx(_client(conn), idempotency_key="key-x"),
        {"title": "My Doc", "content": "hello"},
    )
    assert res.status == "success"
    assert res.output["file_id"] == "file-abc"


def test_create_document_no_idempotency_key_always_creates():
    """Without a key, we go straight to create (no search)."""
    conn = _connector(
        ("POST", "/upload", 200, _GOOD_FILE),
    )
    tool = DriveCreateDocumentTool()
    res = tool.execute(_ctx(_client(conn)), {"title": "My Doc", "content": "hi"})
    assert res.status == "success"
    assert res.output["file_id"] == "file-abc"


# ──────────────────────────────────────────────────────────────────────────────
# drive.create_document — verification
# ──────────────────────────────────────────────────────────────────────────────

def test_verify_success():
    conn = _connector(("GET", "/files/", 200, _GOOD_FILE))
    tool = DriveCreateDocumentTool()
    result = ToolResult(
        status="success", tool="drive.create_document",
        output={"file_id": "file-abc", "title": "My Doc"},
    )
    v = tool.verify(_ctx(_client(conn)), result)
    assert v["verified"] is True
    assert "title" in v["detail"]


def test_verify_title_mismatch():
    conn = _connector(("GET", "/files/", 200, _GOOD_FILE))  # name = "My Doc"
    tool = DriveCreateDocumentTool()
    result = ToolResult(
        status="success", tool="drive.create_document",
        output={"file_id": "file-abc", "title": "Different Title"},  # mismatch
    )
    v = tool.verify(_ctx(_client(conn)), result)
    assert v["verified"] is False
    assert "title" in v["detail"].lower() or "match" in v["detail"].lower()


def test_verify_file_trashed():
    trashed = {**_GOOD_FILE, "trashed": True}
    conn = _connector(("GET", "/files/", 200, trashed))
    tool = DriveCreateDocumentTool()
    result = ToolResult(
        status="success", tool="drive.create_document",
        output={"file_id": "file-abc", "title": "My Doc"},
    )
    v = tool.verify(_ctx(_client(conn)), result)
    assert v["verified"] is False


def test_verify_file_missing():
    conn = _connector(("GET", "/files/", 404, {}))
    tool = DriveCreateDocumentTool()
    result = ToolResult(
        status="success", tool="drive.create_document",
        output={"file_id": "file-abc", "title": "My Doc"},
    )
    v = tool.verify(_ctx(_client(conn)), result)
    assert v["verified"] is False


# ──────────────────────────────────────────────────────────────────────────────
# drive.get_file — success
# ──────────────────────────────────────────────────────────────────────────────

def test_get_file_success():
    conn = _connector(("GET", "/files/", 200, _GOOD_FILE))
    tool = DriveGetFileTool()
    res = tool.execute(_ctx(_client(conn)), {"file_id": "file-abc"})
    assert res.status == "success"
    assert res.output["file_id"] == "file-abc"
    assert res.output["title"] == "My Doc"
    assert res.output["trashed"] is False
    assert res.output["html_link"] == _GOOD_FILE["webViewLink"]
    assert res.evidence[0]["source"] == "google_drive"


def test_get_file_not_found_returns_failed():
    """not_found is caught and returned as status=failed (intentional for read tools)."""
    conn = _connector(("GET", "/files/", 404, {}))
    tool = DriveGetFileTool()
    res = tool.execute(_ctx(_client(conn)), {"file_id": "missing"})
    assert res.status == "failed"
    assert res.error_class == "not_found"
    assert res.output["file_id"] == "missing"


@pytest.mark.parametrize("code,expected_class", [
    (401, "authentication_failed"),
    (403, "permission_denied"),
    (429, "rate_limited"),
    (500, "service_unavailable"),
])
def test_get_file_http_errors(code, expected_class):
    conn = _connector(
        ("GET", "/files/", code, {"error": "invalid_grant"} if code == 401 else {})
    )
    tool = DriveGetFileTool()
    with pytest.raises(GoogleError) as exc:
        tool.execute(_ctx(_client(conn)), {"file_id": "file-abc"})
    assert exc.value.error_class == expected_class


def test_get_file_timeout():
    conn = _connector(("GET", "/files/", 0, httpx.TimeoutException("t")))
    tool = DriveGetFileTool()
    with pytest.raises(GoogleError) as exc:
        tool.execute(_ctx(_client(conn)), {"file_id": "file-abc"})
    assert exc.value.error_class == "timeout"


def test_get_file_network_error():
    conn = _connector(("GET", "/files/", 0, httpx.HTTPError("n")))
    tool = DriveGetFileTool()
    with pytest.raises(GoogleError) as exc:
        tool.execute(_ctx(_client(conn)), {"file_id": "file-abc"})
    assert exc.value.error_class == "network_error"


# ──────────────────────────────────────────────────────────────────────────────
# Simulated tools
# ──────────────────────────────────────────────────────────────────────────────

def test_simulated_create_no_external_url():
    tool = SimulatedDriveCreateDocumentTool()
    ctx = ToolContext(user_id=1, mission_id="m1", task_id="t1")
    res = tool.execute(ctx, {"title": "Sim Doc", "content": "sim content"})

    assert res.status == "success"
    assert res.simulated is True
    assert res.output["title"] == "Sim Doc"
    assert res.output["mime_type"] == "application/vnd.google-apps.document"
    # Must NOT contain a real Google URL
    assert "docs.google.com" not in (res.output.get("html_link") or "")
    assert not any("docs.google.com" in str(ev.get("url") or "") for ev in res.evidence)
    assert all(ev.get("source") == "simulated" for ev in res.evidence)
    # verify returns simulated
    v = tool.verify(ctx, res)
    assert v.get("simulated") is True


def test_simulated_get_no_external_url():
    tool = SimulatedDriveGetFileTool()
    ctx = ToolContext(user_id=1, mission_id="m1", task_id="t1")
    res = tool.execute(ctx, {"file_id": "sim-id"})

    assert res.status == "success"
    assert res.simulated is True
    assert res.output["file_id"] == "sim-id"
    assert "docs.google.com" not in (res.output.get("html_link") or "")
    assert not any("docs.google.com" in str(ev.get("url") or "") for ev in res.evidence)
    assert all(ev.get("source") == "simulated" for ev in res.evidence)


# ──────────────────────────────────────────────────────────────────────────────
# Scope / registry
# ──────────────────────────────────────────────────────────────────────────────

def test_drive_scope_is_drive_file_only():
    assert DriveCreateDocumentTool.required_scopes == ("https://www.googleapis.com/auth/drive.file",)
    assert DriveGetFileTool.required_scopes == ("https://www.googleapis.com/auth/drive.file",)


def test_drive_risk_levels():
    from app.domain import RiskLevel
    assert DriveCreateDocumentTool.risk == RiskLevel.MEDIUM
    assert DriveGetFileTool.risk == RiskLevel.LOW


def test_drive_tools_in_registry():
    from app.tools.drive import DRIVE_TOOLS
    names = {t.name for t in DRIVE_TOOLS}
    assert "drive.create_document" in names
    assert "drive.get_file" in names
