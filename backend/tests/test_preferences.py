"""User preferences (#18): API, validation, per-user isolation, and use at runtime."""

import copy
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.db.models import User
from app.main import create_app
from app.schemas.preferences import Preferences
from app.services.preferences import UnknownGroupError, apply_preferences, load_preferences, next_free_slot
from tests.conftest import make_settings
from tests.test_cross_app import _make_cross_app_plan

FRIEND_SHAPE = {
    "timezone": "Asia/Kolkata",
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "workingHours": {"start": "10:00", "end": "18:00"},
    "displayName": "Anjan",
    "signature": "— Anjan, AgentOS",
    "tone": "Formal",
    "meetingLength": 45,
    "groups": [{"name": "My team", "emails": ["Alice@Example.com", "bob@example.com", "alice@example.com"]}],
    "dismissedNudge": True,  # UI-only field from the frontend: accepted and ignored
}


# ---------------------------------------------------------------- API

def test_defaults_before_anything_is_saved(client):
    prefs = client.get("/api/preferences").json()
    assert prefs["timezone"] == "UTC"
    assert prefs["workingHours"] == {"start": "09:00", "end": "18:00"}
    assert prefs["workingDays"] == ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    assert prefs["groups"] == []


def test_saves_the_frontend_shape_and_returns_it(client):
    res = client.put("/api/preferences", json=FRIEND_SHAPE)
    assert res.status_code == 200, res.text
    saved = client.get("/api/preferences").json()
    assert saved == res.json()
    assert saved["timezone"] == "Asia/Kolkata"
    assert saved["meetingLength"] == 45
    assert saved["groups"] == [{"name": "My team", "emails": ["alice@example.com", "bob@example.com"]}]
    assert "dismissedNudge" not in saved


def test_accepts_snake_case_too(client):
    res = client.put("/api/preferences", json={"timezone": "Europe/London", "meeting_length": 60})
    assert res.status_code == 200
    assert res.json()["meetingLength"] == 60


@pytest.mark.parametrize(
    "patch",
    [
        {"timezone": "Mars/Olympus"},
        {"timezone": "IST"},
        {"workingHours": {"start": "18:00", "end": "09:00"}},
        {"workingHours": {"start": "9am", "end": "5pm"}},
        {"workingDays": []},
        {"workingDays": ["Funday"]},
        {"tone": "Sarcastic"},
        {"meetingLength": 0},
        {"meetingLength": 1000},
        {"groups": [{"name": "Team", "emails": ["not-an-email"]}]},
        {"groups": [{"name": "Team", "emails": []}]},
        {"groups": [{"name": "Team", "emails": ["a@b.co"]}, {"name": "team", "emails": ["c@d.co"]}]},
        {"groups": [{"name": f"g{i}", "emails": ["a@b.co"]} for i in range(21)]},
        {"signature": "x" * 501},
    ],
)
def test_invalid_preferences_are_rejected(client, patch):
    res = client.put("/api/preferences", json={**FRIEND_SHAPE, **patch})
    assert res.status_code == 422, patch
    assert res.json()["error"]["code"] == "validation_error"


def test_preferences_are_per_user(app, client):
    client.put("/api/preferences", json=FRIEND_SHAPE)
    with app.state.session_factory() as db:
        other = User(id="other", email="other@example.com")
        db.add(other)
        db.commit()
        assert load_preferences(db, other).timezone == "UTC"
        assert load_preferences(db, db.get(User, "local")).timezone == "Asia/Kolkata"


def test_preferences_survive_a_restart(tmp_path):
    settings = make_settings(tmp_path)
    a = create_app(settings)
    with TestClient(a) as c:
        c.put("/api/preferences", json=FRIEND_SHAPE)
    a.state.engine.dispose()
    b = create_app(settings)
    with TestClient(b) as c:
        assert c.get("/api/preferences").json()["timezone"] == "Asia/Kolkata"
    b.state.engine.dispose()


def test_production_requires_sign_in(tmp_path):
    prod = create_app(make_settings(tmp_path, environment="production"))
    with TestClient(prod) as c:
        assert c.get("/api/preferences").status_code == 401
    prod.state.engine.dispose()


# ---------------------------------------------------------------- applying preferences

PREFS = Preferences.model_validate(FRIEND_SHAPE)
IST = ZoneInfo("Asia/Kolkata")


def _ist(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=IST).astimezone(timezone.utc)


def test_calendar_event_lands_in_working_hours_in_the_users_timezone():
    # Friday 2 Oct 2026, 17:40 IST: a 45-minute meeting no longer fits today -> Monday 10:00 IST.
    args, applied = apply_preferences("calendar.create_event", {"summary": "Sync"}, PREFS, now=_ist(2026, 10, 2, 17, 40))
    start, end = datetime.fromisoformat(args["start"]), datetime.fromisoformat(args["end"])
    assert start.tzinfo is not None and start.utcoffset() == datetime(2026, 10, 5, tzinfo=IST).utcoffset()
    assert (start.strftime("%A %H:%M"), end.strftime("%H:%M")) == ("Monday 10:00", "10:45")
    assert args["timezone"] == "Asia/Kolkata"
    assert {"timezone", "working_hours", "working_days", "meeting_length"} <= set(applied)


@pytest.mark.parametrize(
    "now, expected",
    [
        (_ist(2026, 10, 1, 8, 5), "Thursday 10:00"),   # before working hours -> start of day
        (_ist(2026, 10, 1, 11, 10), "Thursday 11:30"),  # rounds up to the next half hour
        (_ist(2026, 10, 3, 12, 0), "Monday 10:00"),     # Saturday -> next working day
    ],
)
def test_next_free_slot(now, expected):
    start, _ = next_free_slot(PREFS, now)
    assert start.strftime("%A %H:%M") == expected


def test_an_explicit_time_in_the_goal_wins():
    args, applied = apply_preferences(
        "calendar.create_event", {"start": "2026-10-03T19:00:00+05:30"}, PREFS, now=_ist(2026, 10, 1, 9, 0)
    )
    assert args["start"] == "2026-10-03T19:00:00+05:30"  # Saturday evening kept
    assert args["end"] == "2026-10-03T19:45:00+05:30"
    assert "working_hours" not in applied


def test_drafts_get_the_signature_once_and_the_tone():
    args, applied = apply_preferences("gmail.create_draft", {"body": "Hello all"}, PREFS)
    assert args["body"].endswith("— Anjan, AgentOS")
    again, _ = apply_preferences("gmail.create_draft", args, PREFS)
    assert again["body"].count("— Anjan, AgentOS") == 1
    assert args["tone"] == "Formal" and args["sender_name"] == "Anjan"
    assert {"signature", "tone", "display_name"} <= set(applied)


def test_group_names_expand_and_unknown_groups_are_never_guessed():
    args, applied = apply_preferences("gmail.create_draft", {"to_group": "my  team"}, PREFS)
    assert args["to"] == "alice@example.com, bob@example.com"
    assert "to_group" not in args and "contact_groups" in applied
    with pytest.raises(UnknownGroupError) as err:
        apply_preferences("gmail.create_draft", {"to_group": "marketing"}, PREFS)
    assert "marketing" in err.value.question


def test_other_tools_are_untouched():
    args, applied = apply_preferences("web.search", {"query": "venues"}, PREFS)
    assert args == {"query": "venues"} and applied == []


# ---------------------------------------------------------------- runtime

def _events(client, mid):
    return client.get(f"/api/missions/{mid}/events").json()


def test_runner_applies_preferences_and_runs_exactly_what_was_approved(client):
    client.put("/api/preferences", json=FRIEND_SHAPE)
    req = _make_cross_app_plan()
    draft = next(t for t in req["plan"]["tasks"] if t["id"] == "p3")
    draft["inputs"] = {"to_group": "My team", "subject": "Dinner", "body": "See you there", "body_link": "p2.output.html_link"}
    mid = client.post("/api/missions", json=req).json()["id"]

    client.post(f"/api/missions/{mid}/start")
    requested = [e for e in _events(client, mid) if e["type"] == "APPROVAL_REQUESTED"][0]
    assert requested["payload"]["payload"]["timezone"] == "Asia/Kolkata"
    assert "timezone" in requested["payload"]["applied_preferences"]
    approved_start = requested["payload"]["payload"]["start"]

    client.post(f"/api/approvals/{requested['payload']['approval_id']}/decision", json={"decision": "approve"})
    mission = client.get(f"/api/missions/{mid}").json()
    tasks = {t["key"]: t for t in mission["tasks"]}
    # The calendar step ran with the approved values, not a recomputed slot.
    assert tasks["p2"]["inputs"]["start"] == approved_start
    # The draft went to the stored group, with the signature.
    assert tasks["p3"]["inputs"]["to"] == "alice@example.com, bob@example.com"
    assert tasks["p3"]["inputs"]["body"].endswith("— Anjan, AgentOS")
    called = [e for e in _events(client, mid) if e["type"] == "TOOL_CALLED" and e["payload"]["task_key"] == "p3"][0]
    assert {"contact_groups", "signature"} <= set(called["payload"]["applied_preferences"])


def test_runner_pauses_to_ask_about_an_unknown_group(client):
    client.put("/api/preferences", json=FRIEND_SHAPE)
    req = _make_cross_app_plan()
    req = copy.deepcopy(req)
    req["plan"]["tasks"][2]["inputs"] = {"to_group": "marketing", "subject": "Dinner", "body_link": "p2.output.html_link"}
    mid = client.post("/api/missions", json=req).json()["id"]
    client.post(f"/api/missions/{mid}/start")
    approval = [e for e in _events(client, mid) if e["type"] == "APPROVAL_REQUESTED"][0]
    client.post(f"/api/approvals/{approval['payload']['approval_id']}/decision", json={"decision": "approve"})
    mission = client.get(f"/api/missions/{mid}").json()
    assert mission["status"] == "paused"
    failed = [e for e in _events(client, mid) if e["type"] == "TASK_FAILED"][0]
    assert failed["payload"]["error_class"] == "needs_clarification"
    assert "marketing" in failed["payload"]["message"]
    assert not any(e["type"] == "TOOL_CALLED" and e["payload"]["task_key"] == "p3" for e in _events(client, mid))
