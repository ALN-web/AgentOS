"""Connected apps (#11): honest catalogue, per-user permissions, policy check, activity, disconnect."""

import pytest
from fastapi.testclient import TestClient

from app.capabilities import CAPABILITY_BY_ID
from app.db.models import AppPermission, Evidence, Integration, Mission, Tool, ToolExecution, User
from app.integrations.catalog import APPS
from app.main import create_app
from app.policy.permissions import check_action
from app.tools.registry import register_tool, unregister_tool
from tests.conftest import make_settings

APP_IDS = {"google-calendar", "gmail", "google-drive", "google-forms", "slack", "whatsapp", "notion", "discord"}


def _apps(client):
    return {a["id"]: a for a in client.get("/api/apps").json()}


def _mode(app, action_id):
    return next(a["mode"] for a in app["actions"] if a["id"] == action_id)


@pytest.fixture
def real_calendar_tool():
    register_tool("calendar.create_event")
    yield
    unregister_tool("calendar.create_event")


# ---------------------------------------------------------------- catalogue

def test_catalogue_lists_every_everyday_app(client):
    apps = _apps(client)
    assert set(apps) == APP_IDS
    cal = apps["google-calendar"]
    for field in ("name", "provider", "category", "icon", "description", "disconnect_warning", "granted_scopes"):
        assert field in cal
    assert {a["id"] for a in cal["actions"]} >= {"calendar.read", "calendar.create_event", "calendar.delete_event"}


def test_nothing_claims_to_be_connected_without_a_real_tool_and_account(client):
    for app in _apps(client).values():
        assert app["status"] in ("demo", "coming_soon")
        assert app["account_email"] is None
        assert app["granted_scopes"] == []
        assert not any(a["live"] for a in app["actions"])


def test_external_actions_always_need_approval_or_are_off_by_default(client):
    for app in APPS:
        for action in app.actions:
            if CAPABILITY_BY_ID[action.capability].external and "read" not in action.id:
                assert action.risk.value in ("HIGH", "CRITICAL"), action.id
    apps = _apps(client)
    assert _mode(apps["gmail"], "gmail.send_draft") == "ask"
    assert _mode(apps["google-calendar"], "calendar.create_event") == "ask"
    assert _mode(apps["slack"], "slack.post_message") == "ask"
    assert _mode(apps["discord"], "discord.post_announcement") == "ask"
    assert _mode(apps["gmail"], "gmail.delete") == "off"
    assert _mode(apps["google-calendar"], "calendar.read") == "allowed"


def test_status_is_derived_from_real_tools_and_connection(app, client, real_calendar_tool):
    assert _apps(client)["google-calendar"]["status"] == "available"
    with app.state.session_factory() as db:
        db.add(Integration(user_id="local", provider="google", scopes=["calendar.events"], status="connected", account_email="me@example.com"))
        db.commit()
    cal = _apps(client)["google-calendar"]
    assert cal["status"] == "connected"
    assert cal["account_email"] == "me@example.com"
    assert next(a for a in cal["actions"] if a["id"] == "calendar.create_event")["live"] is True
    # Gmail shares the Google account but has no real tool yet, so it is not "connected".
    assert _apps(client)["gmail"]["status"] == "demo"


# ---------------------------------------------------------------- permissions

def test_permission_changes_persist(client):
    res = client.patch("/api/apps/google-drive/permissions", json={"actions": {"drive.upload": "ask"}})
    assert res.status_code == 200
    assert _mode(res.json(), "drive.upload") == "ask"
    assert _mode(_apps(client)["google-drive"], "drive.upload") == "ask"
    client.patch("/api/apps/google-drive/permissions", json={"actions": {"drive.upload": "off"}})
    assert _mode(_apps(client)["google-drive"], "drive.upload") == "off"


@pytest.mark.parametrize("action", ["gmail.send_draft", "gmail.delete"])
def test_high_and_critical_can_never_be_allowed(client, action):
    res = client.patch("/api/apps/gmail/permissions", json={"actions": {action: "allowed"}})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "permission_not_allowed"


def test_a_bad_change_rejects_the_whole_request(client):
    res = client.patch(
        "/api/apps/gmail/permissions",
        json={"actions": {"gmail.create_draft": "off", "gmail.send_draft": "allowed"}},
    )
    assert res.status_code == 422
    assert _mode(_apps(client)["gmail"], "gmail.create_draft") == "allowed"


@pytest.mark.parametrize(
    "path, body, status, code",
    [
        ("/api/apps/nope/permissions", {"actions": {"x": "ask"}}, 404, "app_not_found"),
        ("/api/apps/gmail/permissions", {"actions": {"calendar.read": "ask"}}, 422, "action_not_found"),
        ("/api/apps/gmail/permissions", {"actions": {"gmail.read": "sometimes"}}, 422, "invalid_mode"),
        ("/api/apps/gmail/permissions", {"actions": {}}, 422, "validation_error"),
        ("/api/apps/Bad_ID/permissions", {"actions": {"gmail.read": "ask"}}, 422, "validation_error"),
    ],
)
def test_invalid_permission_requests(client, path, body, status, code):
    res = client.patch(path, json=body)
    assert res.status_code == status
    assert res.json()["error"]["code"] == code


def test_permissions_are_per_user(app, client):
    client.patch("/api/apps/google-drive/permissions", json={"actions": {"drive.search": "off"}})
    with app.state.session_factory() as db:
        other = User(id="other", email="other@example.com")
        db.add(other)
        db.commit()
        assert check_action(db, other, "drive.search").mode == "allowed"
        assert check_action(db, db.get(User, "local"), "drive.search").mode == "off"


# ---------------------------------------------------------------- policy check (used by #6)

def test_policy_check_follows_permissions(app, client):
    with app.state.session_factory() as db:
        local = db.get(User, "local") or User(id="local", email="local@agentos.dev")
        db.merge(local)
        db.commit()
        d = check_action(db, local, "gmail.send_draft")
        assert (d.mode, d.permitted, d.requires_approval) == ("ask", True, True)
        assert check_action(db, local, "gmail.read").requires_approval is False
        assert check_action(db, local, "gmail.delete").permitted is False
        assert check_action(db, local, "made.up").permitted is False

    client.patch("/api/apps/gmail/permissions", json={"actions": {"gmail.create_draft": "off"}})
    with app.state.session_factory() as db:
        d = check_action(db, db.get(User, "local"), "gmail.create_draft")
        assert not d.permitted and "turned off" in d.reason


def test_a_tampered_row_cannot_unlock_a_high_risk_action(app, client):
    client.get("/api/apps")  # creates the local user
    with app.state.session_factory() as db:
        db.add(AppPermission(user_id="local", app_id="gmail", action_id="gmail.send_draft", mode="allowed"))
        db.commit()
        assert check_action(db, db.get(User, "local"), "gmail.send_draft").mode == "ask"
    assert _mode(_apps(client)["gmail"], "gmail.send_draft") == "ask"


# ---------------------------------------------------------------- activity

def _record(db, user_id, tool, goal, secret="tok-SECRET-123"):
    mission = Mission(user_id=user_id, goal=goal, plan_json={}, metric_label="m", metric_target=1)
    db.add(mission)
    db.flush()
    if db.get(Tool, tool) is None:
        db.add(Tool(name=tool, capability="calendar", risk="HIGH"))
    execution = ToolExecution(mission_id=mission.id, tool_name=tool, risk="HIGH", status="success", input_json={"auth": secret})
    db.add(execution)
    db.flush()
    db.add(Evidence(mission_id=mission.id, tool_execution_id=execution.id, type="calendar_event", source="google", label="Open in Google Calendar", url="https://calendar.google.com/event?eid=x"))
    db.commit()


def test_activity_shows_real_actions_with_proof_and_no_inputs(app, client):
    assert client.get("/api/apps/google-calendar/activity").json() == []
    with app.state.session_factory() as db:
        db.add(User(id="other", email="other@example.com"))
        db.commit()
        client.get("/api/apps")  # ensure the local user exists
        _record(db, "local", "calendar.create_event", "Birthday dinner")
        _record(db, "other", "calendar.create_event", "Someone else's mission")
    res = client.get("/api/apps/google-calendar/activity?limit=5")
    assert res.status_code == 200
    items = res.json()
    assert [i["goal"] for i in items] == ["Birthday dinner"]
    assert items[0]["action"] == "calendar.create_event"
    assert items[0]["evidence"] == [{"label": "Open in Google Calendar", "url": "https://calendar.google.com/event?eid=x"}]
    assert "SECRET" not in res.text
    assert client.get("/api/apps/gmail/activity").json() == []


# ---------------------------------------------------------------- disconnect

def test_disconnect_is_idempotent_and_wipes_the_token(app, client, real_calendar_tool):
    first = client.delete("/api/apps/google-calendar").json()
    assert first == {"id": "google-calendar", "disconnected": False, "affected_apps": ["google-calendar", "gmail", "google-drive", "google-forms"]}
    with app.state.session_factory() as db:
        db.add(Integration(user_id="local", provider="google", status="connected", encrypted_token=b"ciphertext", account_email="me@example.com"))
        db.commit()
    assert _apps(client)["google-calendar"]["status"] == "connected"
    assert client.delete("/api/apps/gmail").json()["disconnected"] is True
    with app.state.session_factory() as db:
        integ = db.query(Integration).filter_by(user_id="local", provider="google").one()
        assert integ.status == "disconnected" and integ.encrypted_token is None
    assert _apps(client)["google-calendar"]["status"] == "available"
    assert client.delete("/api/apps/slack").json() == {"id": "slack", "disconnected": False, "affected_apps": []}
    assert client.delete("/api/apps/nope").status_code == 404


def test_production_requires_sign_in(tmp_path):
    prod = create_app(make_settings(tmp_path, environment="production"))
    with TestClient(prod) as c:
        assert c.get("/api/apps").status_code == 401
    prod.state.engine.dispose()
