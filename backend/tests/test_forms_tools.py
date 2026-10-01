import pytest
from unittest.mock import MagicMock
from app.db.models import Integration, User
from app.tools.base import ToolContext
from app.tools.forms import FormsCreateFormTool, SimulatedFormsCreateFormTool, FormsGetFormTool, SimulatedFormsGetFormTool
from app.integrations.google import GoogleError
from tests.test_google_live import fake, live, connect, start_dinner, events, pending_approval, SCOPES

@pytest.fixture
def fake_client(fake, live):
    app, client = live
    connect(client, fake)
    with app.state.session_factory() as db:
        integ = db.query(Integration).first()
        user = db.query(User).filter(User.id == integ.user_id).first()
        google_client = app.state.google.client_for(db, user)
        yield google_client, user, db, fake, client, app

def test_forms_create_form_tool_real(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="forms_key")

    # Mock search_drive to return nothing (no existing form)
    google_client.search_drive = MagicMock(return_value=[])

    # Mock create_form
    google_client.create_form = MagicMock(return_value={
        "formId": "form123",
        "responderUri": "https://forms.google.com/xyz",
        "info": {"title": "Survey"}
    })

    # Mock update_file_metadata
    google_client.update_file_metadata = MagicMock()

    # Mock update_form
    google_client.update_form = MagicMock()

    tool = FormsCreateFormTool()

    res = tool.execute(ctx, {
        "title": "Survey",
        "description": "Please fill this",
        "questions": [
            {"title": "Name", "type": "text", "required": True},
            {"title": "Bio", "type": "paragraph"},
            {"title": "Role", "type": "choice", "options": ["Admin", "User"]}
        ]
    })

    google_client.create_form.assert_called_with({"info": {"title": "Survey", "documentTitle": "Survey"}})
    google_client.update_file_metadata.assert_called_with("form123", {"appProperties": {"agentos_key": "forms_key"}})
    google_client.update_form.assert_called_once()

    # Validate the batch request
    requests = google_client.update_form.call_args[0][1]["requests"]
    assert len(requests) == 4 # 1 description + 3 questions
    assert "updateFormInfo" in requests[0]

    assert res.status == "success"
    assert res.output["form_id"] == "form123"
    assert res.output["responder_url"] == "https://forms.google.com/xyz"
    assert res.output["edit_url"] == "https://docs.google.com/forms/d/form123/edit"
    assert res.output["title"] == "Survey"
    assert res.output["question_count"] == 3


def test_forms_get_form_real(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="forms_key")
    google_client.get_form = MagicMock(return_value={
        "formId": "form123",
        "info": {"title": "Found Form"},
        "responderUri": "https://forms.google.com/abc",
        "items": [
            {"itemId": "i1", "questionItem": {}},
            {"itemId": "i2", "questionItem": {}},
            {"itemId": "i3", "pageBreakItem": {}} # not a question
        ]
    })

    tool = FormsGetFormTool()
    res = tool.execute(ctx, {"form_id": "form123"})

    google_client.get_form.assert_called_with("form123")

    assert res.status == "success"
    assert res.output["title"] == "Found Form"
    assert res.output["question_count"] == 2
    assert res.output["responder_url"] == "https://forms.google.com/abc"


def test_forms_get_form_not_found(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="forms_key")
    tool = FormsGetFormTool()

    def raise_404(*args, **kwargs):
        from httpx import Response
        r = Response(status_code=404)
        raise GoogleError("not_found", "Form not found", r)

    google_client.get_form = MagicMock(side_effect=raise_404)

    res = tool.execute(ctx, {"form_id": "missing_form"})

    assert res.status == "failed"
    assert res.error_class == "not_found"
    assert res.output["form_id"] == "missing_form"


def test_forms_simulated(fake_client):
    google_client, user, db, fake_g, client, app = fake_client
    ctx = ToolContext(user_id=user.id, mission_id="m1", task_id="t1", db=db, google=google_client, idempotency_key="forms_key")

    c = SimulatedFormsCreateFormTool()
    res1 = c.execute(ctx, {"title": "Simulated Form", "description": "", "questions": [{"title": "Q1", "type": "text"}]})
    assert res1.status == "success"
    assert res1.simulated is True
    assert "form_id" in res1.output
    assert res1.output["question_count"] == 1

    r = SimulatedFormsGetFormTool()
    res2 = r.execute(ctx, {"form_id": res1.output["form_id"]})
    assert res2.status == "success"
    assert res2.simulated is True
    assert res2.output["question_count"] == 0