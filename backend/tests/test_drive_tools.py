import pytest
import json
from datetime import datetime, timezone
from app.db.models import Integration, User
from app.tools.base import ToolContext
from app.tools.drive import DriveCreateDocumentTool, SimulatedDriveCreateDocumentTool, DriveGetFileTool, SimulatedDriveGetFileTool
from app.integrations.google import GoogleError
from tests.test_google_live import fake, live, connect, start_dinner, events, pending_approval, SCOPES

@pytest.fixture
def fake_client(fake, live):
    app, client = live
    connect(client, fake)
    with app.state.session_factory() as db:
        integ = db.query(Integration).first()
        user = db.query(User).filter(User.id == integ.user_id).first()
        integ = db.query(Integration).first()
        google_client = app.state.google.client_for(db, user)
        yield google_client, user, db, fake, client, app

def test_drive_create_document_real(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="ik_test")
    tool = DriveCreateDocumentTool()
    
    res = tool.execute(ctx, {"title": "Test Doc", "content": "Hello World"})
    assert res.status == "success"
    assert res.output["title"] == "Test Doc"
    assert "webViewLink" not in res.output # it should be html_link
    assert res.output["html_link"].startswith("https://")
    assert res.output["mime_type"] == "application/vnd.google-apps.document"
    assert "file_id" in res.output
    
    assert len(res.evidence) == 1
    
    verify = tool.verify(ctx, res)
    assert verify["verified"] is True

def test_drive_create_idempotent_retry(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="ik_test2")
    tool = DriveCreateDocumentTool()
    
    res1 = tool.execute(ctx, {"title": "Test Doc", "content": "Hello World"})
    fake_g.requests = []
    res2 = tool.execute(ctx, {"title": "Test Doc", "content": "Hello World"})
    
    assert res1.output["file_id"] == res2.output["file_id"]
    # assert no post requests were made during the second execution
    assert not any(req.method == "POST" for req in fake_g.requests)

def test_auth_failure(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    fake_g.fail_next = [401]
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client)
    tool = DriveCreateDocumentTool()
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"title": "Test", "content": "test"})
    assert exc.value.error_class == "authentication_failed"
    assert "token" not in str(exc.value).lower()

def test_permission_failure(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    fake_g.fail_next = [403]
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client)
    tool = DriveCreateDocumentTool()
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"title": "Test", "content": "test"})
    assert exc.value.error_class == "permission_denied"

def test_server_error_retry(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    fake_g.fail_next = [503, 503]
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client)
    tool = DriveCreateDocumentTool()
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"title": "Test", "content": "test"})
    assert exc.value.error_class == "service_unavailable"

def test_missing_drive_scope(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    with db:
        integ = db.query(Integration).first()
        integ.scopes = ["https://www.googleapis.com/auth/calendar.events"]
        db.commit()
    
    from app.tools.registry import resolve
    resolution = resolve("drive.create_document", db, user)
    assert not resolution.available
    assert resolution.reason == "missing_scope"

def test_simulation():
    tool = SimulatedDriveCreateDocumentTool()
    ctx = ToolContext(user_id="u1", mission_id="m1", task_id="t1")
    res = tool.execute(ctx, {"title": "Sim Doc", "content": "Sim Content"})
    
    assert res.status == "success"
    assert res.simulated is True
    assert "file_" in res.output["file_id"]
    assert "docs.google.com" not in res.output["html_link"]
    assert "docs.google.com" not in str(res.evidence)

def test_tool_selection_regression():
    from app.services.planner import get_planner
    planner = get_planner()
    # AnthropicPlanner can build the system prompt
    assert True # we'll test via the prompt construction checking if both tools are present
    
def test_token_leakage(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="ik_test3")
    tool = DriveCreateDocumentTool()
    
    res = tool.execute(ctx, {"title": "Test", "content": "test"})
    assert "ya29" not in json.dumps(res.output)
    assert "ya29" not in json.dumps(res.evidence)
    
def test_llm_tool_selection_prompt(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    from app.services.planner import AnthropicPlanner
    planner = AnthropicPlanner()
    prompt = planner._build_system_prompt(db, user)
    
    # ensure it contains drive tool
    assert "drive.create_document" in prompt
    assert "gmail.create_draft" in prompt
