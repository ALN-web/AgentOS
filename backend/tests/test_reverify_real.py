"""Re-verifying a real Google mission keeps honest proof green (#14), and busy calendars are read fully."""

import httpx

from app.integrations.google import GoogleClient
from tests.test_google_live import _no_backoff, connect, fake, live, pending_approval, start_dinner  # noqa: F401  (fixtures)


def run_dinner(client, fake):
    connect(client, fake)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    assert client.get(f"/api/missions/{mid}").json()["status"] == "completed"
    return mid


def test_reverify_keeps_every_real_proof_verified(live, fake):
    _, client = live
    mid = run_dinner(client, fake)
    evidence = {e["type"]: e for e in client.get(f"/api/missions/{mid}/evidence").json()}
    assert evidence["gmail_draft"]["url"] is None  # the draft was sent; its link would be dead

    client.post(f"/api/missions/{mid}/verify")
    after = {e["type"]: e for e in client.get(f"/api/missions/{mid}/evidence").json()}
    assert {t: e["status"] for t, e in after.items()} == {
        "calendar_availability": "verified", "calendar_event": "verified", "gmail_draft": "verified", "gmail_message": "verified",
    }
    assert "left Drafts" in after["gmail_message"]["method"]
    assert "was sent" in after["gmail_draft"]["method"]


def test_reverify_catches_a_deleted_event(live, fake):
    _, client = live
    mid = run_dinner(client, fake)
    fake.events.clear()  # someone deleted the event in Google Calendar
    client.post(f"/api/missions/{mid}/verify")
    after = {e["type"]: e for e in client.get(f"/api/missions/{mid}/evidence").json()}
    assert after["calendar_event"]["status"] == "failed"
    assert after["gmail_message"]["status"] == "verified"


def test_list_events_reads_every_page(live, fake):
    app, client = live
    connect(client, fake)
    pages = {None: ({"items": [{"id": f"a{i}"} for i in range(250)], "nextPageToken": "p2"}),
             "p2": ({"items": [{"id": "b1"}, {"id": "b2"}]})}

    def handler(req):
        return httpx.Response(200, json=pages[req.url.params.get("pageToken")])

    with app.state.session_factory() as db:
        g = app.state.google.client_for(db, db.query(__import__("app.db.models", fromlist=["User"]).User).filter_by(id="local").one())
        assert isinstance(g, GoogleClient)
        app.state.google.transport = httpx.MockTransport(handler)
        items = g.list_events("2026-10-01T00:00:00Z", "2026-10-15T00:00:00Z")
    assert len(items) == 252
