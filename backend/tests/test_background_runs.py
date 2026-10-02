"""Missions run on a background worker (#44): requests return at once, runs never overlap."""

import threading
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.db.models import Mission
from app.main import create_app
from app.services import runner
from tests.conftest import make_settings
from tests.test_google_live import GOOGLE, FakeGoogle, _no_backoff, connect, pending_approval, start_dinner  # noqa: F401


@pytest.fixture
def bg(tmp_path):
    fake = FakeGoogle()
    app = create_app(make_settings(tmp_path, background_runs=True, **GOOGLE))
    app.state.google.transport = httpx.MockTransport(fake.handler)
    with TestClient(app, raise_server_exceptions=False) as client:
        yield app, client, fake
    app.state.engine.dispose()


def settle(app):
    assert app.state.worker.wait_idle(timeout=30)


def test_a_whole_real_mission_runs_in_the_background(bg):
    app, client, fake = bg
    connect(client, fake)
    mid = start_dinner(client)  # returns before the mission has run
    settle(app)
    assert client.get(f"/api/missions/{mid}").json()["status"] == "awaiting_approval"

    for _ in range(2):  # the calendar event, then the email
        aid = pending_approval(client, mid)["approval_id"]
        res = client.post(f"/api/approvals/{aid}/decision", json={"decision": "approve"})
        assert res.status_code == 200 and res.json()["status"] == "approved"
        settle(app)

    assert client.get(f"/api/missions/{mid}").json()["status"] == "completed"
    assert len(fake.events) == 1 and len(fake.sent) == 1


def test_start_returns_without_waiting_for_slow_steps(bg, monkeypatch):
    app, client, fake = bg
    connect(client, fake)
    gate = threading.Event()
    real_run = runner.run_mission

    def slow_run(*args, **kwargs):
        gate.wait(5)  # the mission is "busy" until the test lets it go
        return real_run(*args, **kwargs)

    monkeypatch.setattr(runner, "run_mission", slow_run)
    t = time.monotonic()
    mid = start_dinner(client)
    assert time.monotonic() - t < 2  # the request did not wait for the run
    gate.set()
    settle(app)
    assert client.get(f"/api/missions/{mid}").json()["status"] == "awaiting_approval"


def test_runs_of_one_mission_never_overlap_and_none_is_lost(bg, monkeypatch):
    app, client, fake = bg
    connect(client, fake)
    mid = start_dinner(client)
    settle(app)

    running, overlaps, calls = [0], [0], [0]
    lock = threading.Lock()
    started = threading.Event()
    real_run = runner.run_mission

    def tracked(*args, **kwargs):
        with lock:
            running[0] += 1
            calls[0] += 1
            overlaps[0] = max(overlaps[0], running[0])
        started.set()
        time.sleep(0.3)
        try:
            return real_run(*args, **kwargs)
        finally:
            with lock:
                running[0] -= 1

    monkeypatch.setattr(runner, "run_mission", tracked)
    user_id = "local"
    app.state.worker.submit(mid, user_id)
    assert started.wait(5)
    for _ in range(2):  # two more requests while the first run is still going
        app.state.worker.submit(mid, user_id)
    settle(app)
    assert overlaps[0] == 1  # never two runs of the same mission at once
    assert calls[0] == 2  # the first run, plus exactly one more for the requests that arrived meanwhile


def test_an_unexpected_crash_marks_the_mission_failed_not_stuck(bg, monkeypatch):
    app, client, fake = bg
    connect(client, fake)

    def boom(db, user, mission_id, google=None):
        m = db.get(Mission, mission_id)
        m.status = "running"
        db.commit()
        raise RuntimeError("unexpected")

    monkeypatch.setattr(runner, "run_mission", boom)
    mid = start_dinner(client)
    settle(app)
    mission = client.get(f"/api/missions/{mid}").json()
    assert mission["status"] == "failed"
    events = client.get(f"/api/missions/{mid}/events").json()
    assert events[-1]["type"] == "MISSION_FAILED" and "Start it again" in events[-1]["payload"]["summary"]
