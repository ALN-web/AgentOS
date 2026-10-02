import copy
import json
from pathlib import Path
import pytest
from app.db.models import Mission, User
from app.domain import EventType
from app.services.missions import append_event, get_mission

FIXTURES = Path(__file__).parent / "fixtures" / "plans"
PLANS = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted(FIXTURES.glob("*.json"))}


def body(name: str) -> dict:
    fx = PLANS[name]
    return {"goal": fx["goal"], "plan": copy.deepcopy(fx["plan"])}


def _create_sample_mission(client):
    res = client.post("/api/missions", json=body("dinner"))
    assert res.status_code == 201
    return res.json()


def test_stream_owner_only_and_404(app, client):
    m = _create_sample_mission(client)
    mid = m["id"]

    # Mission exists for client ("local" user)
    res_ok = client.get(f"/api/v1/missions/{mid}/stream")
    assert res_ok.status_code == 200

    # Move mission to another user ("other")
    with app.state.session_factory() as db:
        other = User(id="other", email="other@example.com")
        db.add(other)
        db.commit()
        db.get(Mission, mid).user_id = "other"
        db.commit()

    # Now accessing as local user returns 404
    res_other = client.get(f"/api/v1/missions/{mid}/stream")
    assert res_other.status_code == 404

    # Non-existent mission returns 404
    missing_res = client.get("/api/v1/missions/non-existent-id/stream")
    assert missing_res.status_code == 404


def test_stream_v1_and_api_prefix_both_work(client):
    m = _create_sample_mission(client)
    mid = m["id"]

    res_v1 = client.get(f"/api/v1/missions/{mid}/stream")
    assert res_v1.status_code == 200
    assert "text/event-stream" in res_v1.headers["content-type"]

    res_std = client.get(f"/api/missions/{mid}/stream")
    assert res_std.status_code == 200
    assert "text/event-stream" in res_std.headers["content-type"]


def test_stream_carries_seq_id_and_resumes_from_last_event_id(app, client):
    m = _create_sample_mission(client)
    mid = m["id"]

    # Append additional events
    with app.state.session_factory() as db:
        user = db.get(User, "local")
        mission = get_mission(db, user, mid)
        append_event(db, mission, EventType.MISSION_STARTED, "planner", {"status": "running"})
        append_event(db, mission, EventType.AGENT_ASSIGNED, "execution", {"task_key": "p1", "agent": "execution"})
        append_event(db, mission, EventType.TASK_STARTED, "execution", {"task_key": "p1"})
        append_event(db, mission, EventType.TOOL_COMPLETED, "execution", {"task_key": "p1", "output": {"slot": "7pm"}})
        db.commit()

    # Initial stream returns all 5 events (MISSION_CREATED seq 1, then seq 2..5)
    full_stream = client.get(f"/api/v1/missions/{mid}/stream").text
    lines = [line for line in full_stream.strip().split("\n") if line.startswith("id:")]
    assert len(lines) == 5
    assert lines[0] == "id: 1"
    assert lines[4] == "id: 5"

    # Resuming with Last-Event-ID: 3 replays only seq 4 and 5 with no duplicates
    resumed = client.get(f"/api/v1/missions/{mid}/stream", headers={"Last-Event-ID": "3"}).text
    resumed_ids = [line for line in resumed.strip().split("\n") if line.startswith("id:")]
    assert len(resumed_ids) == 2
    assert resumed_ids == ["id: 4", "id: 5"]
    assert "event: TOOL_COMPLETED" in resumed
    assert "event: MISSION_CREATED" not in resumed

    # Query param ?after=4 replays only seq 5
    after_stream = client.get(f"/api/v1/missions/{mid}/stream?after=4").text
    after_ids = [line for line in after_stream.strip().split("\n") if line.startswith("id:")]
    assert len(after_ids) == 1
    assert after_ids == ["id: 5"]


def test_stream_event_payload_schema_and_types(app, client):
    m = _create_sample_mission(client)
    mid = m["id"]

    with app.state.session_factory() as db:
        user = db.get(User, "local")
        mission = get_mission(db, user, mid)
        append_event(db, mission, EventType.TOOL_CALLED, "execution", {"task_key": "p2", "tool": "calendar.create_event"})
        append_event(db, mission, EventType.APPROVAL_REQUESTED, "approval", {"approval_id": "appr-1", "reason": "High risk"})
        append_event(db, mission, EventType.APPROVAL_GRANTED, "approval", {"approval_id": "appr-1", "edited": False})
        append_event(db, mission, EventType.VERIFICATION_STARTED, "verification", {})
        append_event(db, mission, EventType.VERIFICATION_COMPLETED, "verification", {"verified": True})
        append_event(db, mission, EventType.MISSION_COMPLETED, "planner", {"status": "completed"})
        db.commit()

    stream_text = client.get(f"/api/v1/missions/{mid}/stream").text

    # Parse and verify event format and data payloads
    chunks = stream_text.strip().split("\n\n")
    events = []
    for chunk in chunks:
        if chunk.startswith(":"):
            continue
        ev = {}
        for line in chunk.split("\n"):
            if line.startswith("id:"):
                ev["id"] = int(line.split(":", 1)[1].strip())
            elif line.startswith("event:"):
                ev["type"] = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                ev["data"] = json.loads(line.split(":", 1)[1].strip())
        if ev:
            events.append(ev)

    types = [e["type"] for e in events]
    assert "MISSION_CREATED" in types
    assert "TOOL_CALLED" in types
    assert "APPROVAL_REQUESTED" in types
    assert "APPROVAL_GRANTED" in types
    assert "VERIFICATION_STARTED" in types
    assert "VERIFICATION_COMPLETED" in types
    assert "MISSION_COMPLETED" in types

    for e in events:
        data = e["data"]
        assert "seq" in data
        assert "type" in data
        assert "agent" in data
        assert "created_at" in data
        assert "payload" in data


def test_live_stream_receives_events_and_closes_on_completion(app, client):
    m = _create_sample_mission(client)
    mid = m["id"]

    # Mark mission completed in DB
    with app.state.session_factory() as db:
        user = db.get(User, "local")
        mission = get_mission(db, user, mid)
        append_event(db, mission, EventType.MISSION_STARTED, "planner", {"status": "running"})
        append_event(db, mission, EventType.MISSION_COMPLETED, "planner", {"status": "completed"})
        mission.status = "completed"
        db.commit()

    with client.stream("GET", f"/api/v1/missions/{mid}/stream", headers={"Accept": "text/event-stream"}) as stream:
        lines = [line for line in stream.iter_lines() if line.startswith("id:")]
        # Receives MISSION_CREATED (1), MISSION_STARTED (2), MISSION_COMPLETED (3)
        assert len(lines) == 3
        assert lines == ["id: 1", "id: 2", "id: 3"]




def test_the_stream_reads_the_database_off_the_event_loop(app, client, monkeypatch):
    """Render restarts the server when /api/health takes over 5 s: a stream must never block the loop."""
    import asyncio
    import threading

    from app.api import missions as api

    mid = _create_sample_mission(client)["id"]
    loop_threads, poll_threads = [], []
    real_to_thread = asyncio.to_thread

    async def tracking_to_thread(fn, *args, **kwargs):
        loop_threads.append(threading.get_ident())

        def run():
            poll_threads.append(threading.get_ident())
            return fn(*args, **kwargs)
        return await real_to_thread(run)

    monkeypatch.setattr(api.asyncio, "to_thread", tracking_to_thread)
    res = client.get(f"/api/missions/{mid}/stream")
    assert res.status_code == 200 and "id: 1" in res.text
    assert poll_threads and all(p != l for p, l in zip(poll_threads, loop_threads))
