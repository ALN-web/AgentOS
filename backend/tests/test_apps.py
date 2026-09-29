"""Tests for connected apps catalogue, permissions, and activity audit endpoints."""

from fastapi.testclient import TestClient


def test_list_apps_catalogue(client: TestClient):
    res = client.get("/api/apps")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    ids = [a["id"] for a in data]
    assert "google-calendar" in ids
    assert "gmail" in ids
    assert "google-drive" in ids
    assert "slack" in ids
    assert "whatsapp" in ids
    assert "notion" in ids
    assert "discord" in ids

    # Check structure of an app
    calendar = next(a for a in data if a["id"] == "google-calendar")
    assert calendar["status"] == "connected"
    assert calendar["account_email"] == "alex.chen@agentos.org"
    assert len(calendar["actions"]) > 0


def test_update_permission_success(client: TestClient):
    # calendar.create_event is MEDIUM risk; can be set to 'ask'
    res = client.patch(
        "/api/apps/google-calendar/permissions",
        json={"actions": {"calendar.create_event": "ask"}},
    )
    assert res.status_code == 200
    updated = res.json()
    action = next(a for a in updated["actions"] if a["id"] == "calendar.create_event")
    assert action["mode"] == "ask"


def test_high_and_critical_cannot_be_set_to_allowed(client: TestClient):
    # calendar.update_event is HIGH risk; cannot be set to 'allowed'
    res = client.patch(
        "/api/apps/google-calendar/permissions",
        json={"actions": {"calendar.update_event": "allowed"}},
    )
    assert res.status_code == 422
    err = res.json()
    assert "cannot be set to 'allowed'" in str(err)

    # calendar.delete_event is CRITICAL risk; cannot be set to 'allowed'
    res_crit = client.patch(
        "/api/apps/google-calendar/permissions",
        json={"actions": {"calendar.delete_event": "allowed"}},
    )
    assert res_crit.status_code == 422


def test_get_app_activity(client: TestClient):
    res = client.get("/api/apps/google-calendar/activity?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    if data:
        assert "action" in data[0]
        assert "evidence" in data[0]


def test_disconnect_app(client: TestClient):
    res = client.delete("/api/apps/google-calendar")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "google-calendar"
    assert data["disconnected"] is True
