"""Real Gmail + Google Calendar in Live Mode (#6), against a fake Google.

The fake speaks the same HTTP as Google (OAuth token endpoint, Calendar v3, Gmail v1)
through httpx.MockTransport, so no real credentials are needed in CI or the repo.
"""

import base64
import copy
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from email import message_from_string
from email.policy import default
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.db.models import Approval, Integration
from app.main import create_app
from app.services import runner
from app.tools.google import GOOGLE_TOOLS
from app.tools.registry import unregister_tool
from tests.conftest import make_settings
from tests.test_cross_app import _make_cross_app_plan

KEY = Fernet.generate_key().decode()
GOOGLE = {"google_client_id": "client-123.apps.googleusercontent.com", "google_client_secret": "shh-client-secret", "encryption_key": KEY}
SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/forms.responses.readonly"


class FakeGoogle:
    def __init__(self):
        self.valid_tokens = set()
        self.issued = []  # every token handed out, to check none ever leaks
        self.challenge = None
        self.scope = SCOPES
        self.refresh_ok = True
        self.events: dict[str, dict] = {}
        self.drafts: dict[str, dict] = {}
        self.sent: list[dict] = []
        self.files: dict[str, dict] = {}
        self.revoked: list[str] = []
        self.fail_next: list[int] = []  # status codes to return for the next API calls
        self.requests: list[httpx.Request] = []
        self._n = 0

    def _token(self, kind="at"):
        self._n += 1
        t = f"ya29.{kind}-{self._n}-SECRET"
        self.issued.append(t)
        if kind == "at":
            self.valid_tokens.add(t)
        return t

    def handler(self, req: httpx.Request) -> httpx.Response:
        self.requests.append(req)
        url, path, m = req.url, req.url.path, req.method
        if url.host == "oauth2.googleapis.com" and path == "/token":
            form = parse_qs(req.content.decode())
            grant = form["grant_type"][0]
            if grant == "authorization_code":
                verifier = form["code_verifier"][0]
                s256 = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
                if form["code"][0] != "good-code" or s256 != self.challenge:
                    return httpx.Response(400, json={"error": "invalid_grant"})
                return httpx.Response(200, json={"access_token": self._token(), "refresh_token": self._token("rt"),
                                                 "expires_in": 3599, "scope": self.scope, "token_type": "Bearer"})
            if grant == "refresh_token":
                if not self.refresh_ok:
                    return httpx.Response(400, json={"error": "invalid_grant"})
                return httpx.Response(200, json={"access_token": self._token(), "expires_in": 3599})
        if url.host == "oauth2.googleapis.com" and path == "/revoke":
            self.revoked.append(parse_qs(req.content.decode())["token"][0])
            return httpx.Response(200)

        auth = req.headers.get("Authorization", "")
        if auth.removeprefix("Bearer ") not in self.valid_tokens:
            return httpx.Response(401, json={"error": {"code": 401, "message": "Invalid Credentials"}})
        if self.fail_next:
            return httpx.Response(self.fail_next.pop(0), json={"error": {"code": 503, "message": "backend error"}})

        if path == "/gmail/v1/users/me/profile":
            return httpx.Response(200, json={"emailAddress": "me@example.com"})
        if path == "/calendar/v3/calendars/primary/events" and m == "GET":
            return httpx.Response(200, json={"items": list(self.events.values())})
        if path == "/calendar/v3/calendars/primary/events" and m == "POST":
            body = json.loads(req.content)
            if body["id"] in self.events:
                return httpx.Response(409, json={"error": {"code": 409, "message": "duplicate"}})
            ev = {**body, "status": "confirmed", "htmlLink": f"https://www.google.com/calendar/event?eid={body['id']}"}
            self.events[body["id"]] = ev
            return httpx.Response(200, json=ev)
        if path.startswith("/calendar/v3/calendars/primary/events/"):
            ev = self.events.get(path.rsplit("/", 1)[1])
            return httpx.Response(200, json=ev) if ev else httpx.Response(404, json={"error": {"code": 404}})
        if path == "/gmail/v1/users/me/drafts" and m == "POST":
            raw = base64.urlsafe_b64decode(json.loads(req.content)["message"]["raw"]).decode()
            did = f"r{len(self.drafts) + 1}"
            self.drafts[did] = {"id": did, "message": {"id": f"m{did}", "threadId": f"t{did}"}, "raw": raw}
            return httpx.Response(200, json={"id": did, "message": self.drafts[did]["message"]})
        if path == "/gmail/v1/users/me/drafts/send":
            d = self.drafts.pop(json.loads(req.content)["id"], None)
            if d is None:
                return httpx.Response(404, json={"error": {"code": 404}})
            self.sent.append(d)
            return httpx.Response(200, json={"id": d["message"]["id"], "threadId": d["message"]["threadId"], "labelIds": ["SENT"]})
        if path.startswith("/gmail/v1/users/me/drafts/"):
            d = self.drafts.get(path.rsplit("/", 1)[1])
            return httpx.Response(200, json={"id": d["id"], "message": d["message"]}) if d else httpx.Response(404, json={"error": {"code": 404}})
        if path.startswith("/gmail/v1/users/me/messages/"):
            mid = path.rsplit("/", 1)[1]
            msg = next((d["message"] for d in self.sent if d.get("message", {}).get("id") == mid or d.get("id") == mid), None)
            return httpx.Response(200, json=msg) if msg else httpx.Response(404, json={"error": {"code": 404}})
        
        if path == "/drive/v3/files" and m == "GET":
            q = req.url.params.get("q", "")
            return httpx.Response(200, json={"files": [f for f in self.files.values() if not f.get("trashed") and "agentos_key" in q and f.get("appProperties", {}).get("agentos_key") in q]})
        if path == "/upload/drive/v3/files" and m == "POST":
            import email
            import email.policy
            # Parse multipart
            content_type = req.headers.get("content-type")
            msg = email.message_from_bytes(
                b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + req.content,
                policy=email.policy.default
            )
            parts = list(msg.iter_parts())
            metadata = json.loads(parts[0].get_payload(decode=True))
            fid = f"file_{len(self.files) + 1}"
            f = {**metadata, "id": fid, "webViewLink": f"https://docs.google.com/document/d/{fid}", "trashed": False}
            self.files[fid] = f
            return httpx.Response(200, json=f)
        if path.startswith("/drive/v3/files/") and m == "GET":
            fid = path.rsplit("/", 1)[1]
            f = self.files.get(fid)
            return httpx.Response(200, json=f) if f else httpx.Response(404, json={"error": {"code": 404}})
            
        return httpx.Response(404, json={"error": {"code": 404, "message": f"fake has no {m} {path}"}})


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch):
    monkeypatch.setattr(runner, "RETRY_BACKOFF_SECONDS", 0)
    yield
    for t in GOOGLE_TOOLS:
        unregister_tool(t.name)
        unregister_tool(t.action_id or t.name)


@pytest.fixture
def fake():
    return FakeGoogle()


@pytest.fixture
def live(tmp_path, fake):
    """(app, client) with Google configured and talking to the fake."""
    app = create_app(make_settings(tmp_path, **GOOGLE))
    app.state.google.transport = httpx.MockTransport(fake.handler)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield app, c
    app.state.engine.dispose()


def connect(client, fake):
    url = client.post("/api/integrations/google/connect").json()["authorization_url"]
    q = parse_qs(urlparse(url).query)
    fake.challenge = q["code_challenge"][0]
    return client.get("/api/integrations/google/callback", params={"code": "good-code", "state": q["state"][0]}, follow_redirects=False)


def events(client, mid):
    return client.get(f"/api/missions/{mid}/events").json()


def pending_approval(client, mid):
    return [e for e in events(client, mid) if e["type"] == "APPROVAL_REQUESTED"][-1]["payload"]


def start_dinner(client, plan=None):
    mid = client.post("/api/missions", json=plan or _make_cross_app_plan()).json()["id"]
    client.post(f"/api/missions/{mid}/start")
    return mid


# ---------------------------------------------------------------- configuration and OAuth

def test_health_reports_live_mode_only_when_google_is_configured(client, live):
    h = client.get("/api/health").json()["live_mode"]
    assert h["available"] is False and "not configured" in h["reason"]
    assert live[1].get("/api/health").json()["live_mode"]["available"] is True


def test_connect_refused_without_configuration(client):
    res = client.post("/api/integrations/google/connect")
    assert res.status_code == 503 and res.json()["error"]["code"] == "google_not_configured"


def test_authorization_url_uses_pkce_minimal_scopes_and_an_opaque_state(live):
    url = live[1].post("/api/integrations/google/connect").json()["authorization_url"]
    q = parse_qs(urlparse(url).query)
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert q["code_challenge_method"] == ["S256"] and len(q["code_challenge"][0]) == 43
    assert set(q["scope"][0].split()) == set(SCOPES.split())
    assert q["redirect_uri"] == ["http://localhost:8000/api/integrations/google/callback"]
    assert "local" not in q["state"][0]  # encrypted, not readable by the browser


def test_callback_stores_encrypted_tokens_and_reports_the_real_account(live, fake):
    app, client = live
    res = connect(client, fake)
    assert res.status_code == 303 and res.headers["location"] == "http://localhost:3000/app/apps?connected=google"
    integs = client.get("/api/integrations").json()
    assert len(integs) == 1
    assert integs[0]["provider"] == "google" and integs[0]["status"] == "connected" and integs[0]["account_email"] == "me@example.com"
    assert set(integs[0]["scopes"]) == set(SCOPES.split())
    with app.state.session_factory() as db:
        integ = db.query(Integration).one()
        assert all(t.encode() not in integ.encrypted_token for t in fake.issued)


@pytest.mark.parametrize("tamper", ["garbage", "other-user"])
def test_forged_or_foreign_state_is_refused(live, fake, tamper):
    app, client = live
    if tamper == "garbage":
        state = "not-a-real-state"
    else:
        state = app.state.google.vault.seal({"u": "someone-else", "v": "x", "n": "1"}).decode()
    res = client.get("/api/integrations/google/callback", params={"code": "good-code", "state": state}, follow_redirects=False)
    assert res.headers["location"].endswith("?error=invalid_state")
    assert client.get("/api/integrations").json()[0]["status"] == "not_connected"


def test_both_scopes_are_required(live, fake):
    fake.scope = "https://www.googleapis.com/auth/calendar.events"
    assert connect(live[1], fake).headers["location"].endswith("?error=missing_scopes")


def test_user_denying_consent_comes_back_with_a_clean_error(live):
    res = live[1].get("/api/integrations/google/callback", params={"error": "access_denied"}, follow_redirects=False)
    assert res.headers["location"].endswith("?error=access_denied")


def test_disconnect_revokes_and_wipes_tokens(live, fake):
    app, client = live
    connect(client, fake)
    assert client.delete("/api/integrations/google").status_code == 204
    assert fake.revoked and fake.revoked[0] in fake.issued
    assert all("token=" not in str(r.url) for r in fake.requests)  # the token went in the body
    with app.state.session_factory() as db:
        assert db.query(Integration).one().encrypted_token is None
    assert client.get("/api/integrations").json()[0]["status"] == "not_connected"


def test_state_replay_is_rejected(live, fake):
    app, client = live
    url = client.post("/api/integrations/google/connect").json()["authorization_url"]
    q = parse_qs(urlparse(url).query)
    fake.challenge = q["code_challenge"][0]
    res1 = client.get("/api/integrations/google/callback", params={"code": "good-code", "state": q["state"][0]}, follow_redirects=False)
    assert res1.status_code == 303 and "connected=google" in res1.headers["location"]
    # Replaying the exact same state must be rejected
    res2 = client.get("/api/integrations/google/callback", params={"code": "good-code", "state": q["state"][0]}, follow_redirects=False)
    assert res2.headers["location"].endswith("?error=invalid_state")


def test_incremental_scopes_and_accumulation(live, fake):
    app, client = live
    # 1. Connect requesting only calendar
    url = client.post("/api/v1/integrations/google/connect", json={"apps": ["google-calendar"]}).json()["authorization_url"]
    q = parse_qs(urlparse(url).query)
    assert q["scope"] == ["https://www.googleapis.com/auth/calendar.events"]
    fake.challenge = q["code_challenge"][0]
    fake.scope = "https://www.googleapis.com/auth/calendar.events"
    res1 = client.get("/api/integrations/google/callback", params={"code": "good-code", "state": q["state"][0]}, follow_redirects=False)
    assert res1.status_code == 303 and "connected=google" in res1.headers["location"]

    integ1 = client.get("/api/v1/integrations").json()[0]
    assert integ1["scopes"] == ["https://www.googleapis.com/auth/calendar.events"]

    # 2. Incrementally request gmail
    url2 = client.post("/api/v1/integrations/google/connect", json={"apps": ["gmail"]}).json()["authorization_url"]
    q2 = parse_qs(urlparse(url2).query)
    assert q2["scope"] == ["https://www.googleapis.com/auth/gmail.compose"]
    fake.challenge = q2["code_challenge"][0]
    fake.scope = "https://www.googleapis.com/auth/gmail.compose"
    res2 = client.get("/api/integrations/google/callback", params={"code": "good-code", "state": q2["state"][0]}, follow_redirects=False)
    assert res2.status_code == 303 and "connected=google" in res2.headers["location"]

    integ2 = client.get("/api/v1/integrations").json()[0]
    assert set(integ2["scopes"]) == {
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/gmail.compose",
    }


def test_invalid_grant_marks_integration_needs_reconnect(live, fake):
    app, client = live
    connect(client, fake)
    fake.refresh_ok = False
    with app.state.session_factory() as db:
        integ = db.query(Integration).one()
        integ.token_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

    # Triggering access_token will fail refresh and mark needs_reconnect
    with pytest.raises(Exception):
        with app.state.session_factory() as db:
            integ = db.query(Integration).one()
            app.state.google.access_token(db, integ)

    integ_data = client.get("/api/integrations").json()[0]
    assert integ_data["status"] == "needs_reconnect"


def test_app_disconnect_revokes_token_at_google_and_affects_google_apps(live, fake):
    app, client = live
    connect(client, fake)
    res = client.delete("/api/apps/google-calendar")
    assert res.status_code == 200
    data = res.json()
    assert data["disconnected"] is True
    assert data["affected_apps"] == ["google-calendar", "gmail", "google-drive", "google-forms"]
    assert fake.revoked and fake.revoked[0] in fake.issued
    assert client.get("/api/integrations").json()[0]["status"] == "not_connected"


# ---------------------------------------------------------------- the birthday dinner, for real

def test_birthday_dinner_runs_end_to_end_against_google(live, fake):
    app, client = live
    connect(client, fake)
    mid = start_dinner(client)

    first = pending_approval(client, mid)
    assert first["task_key"] == "p2" and first["simulated"] is False
    assert fake.events == {}  # nothing created before approval
    client.post(f"/api/approvals/{first['approval_id']}/decision", json={"decision": "approve"})
    assert len(fake.events) == 1 and len(fake.drafts) == 1 and fake.sent == []  # draft runs automatically, send waits

    second = pending_approval(client, mid)
    assert second["task_key"] == "p4"
    client.post(f"/api/approvals/{second['approval_id']}/decision", json={"decision": "approve"})

    mission = client.get(f"/api/missions/{mid}").json()
    assert mission["status"] == "completed"
    assert len(fake.sent) == 1
    email = message_from_string(fake.sent[0]["raw"], policy=default)
    assert email["To"] == "guest@example.com"
    event = next(iter(fake.events.values()))
    assert event["htmlLink"] in email.get_content()  # the real link travelled into the email

    evidence = client.get(f"/api/missions/{mid}/evidence").json()
    urls = {e["type"]: e["url"] for e in evidence}
    assert urls["calendar_event"] == event["htmlLink"]
    assert urls["gmail_message"].startswith("https://mail.google.com/mail/u/0/#all/")

    evs = events(client, mid)
    assert all(e["payload"]["simulated"] is False for e in evs if e["type"] == "TASK_STARTED")
    verified = [e for e in evs if e["type"] == "VERIFICATION_COMPLETED"][0]["payload"]
    assert verified["verified"] is True and all(c["passed"] and not c.get("simulated") for c in verified["criteria"])
    # Verification re-read both from Google, not "the agent said so".
    reads = [(r.method, r.url.path) for r in fake.requests]
    assert ("GET", f"/calendar/v3/calendars/primary/events/{event['id']}") in reads
    assert ("GET", "/gmail/v1/users/me/drafts/r1") in reads


def test_rejecting_the_send_leaves_the_draft_unsent_and_the_criterion_open(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "reject"})

    mission = client.get(f"/api/missions/{mid}").json()
    assert mission["status"] == "completed"
    assert fake.sent == [] and len(fake.drafts) == 1
    tasks = {t["key"]: t["status"] for t in mission["tasks"]}
    assert tasks["p4"] == "skipped"
    evs = events(client, mid)
    assert any(e["type"] == "PLAN_UPDATED" and e["payload"]["strategy"] == "skipped_due_to_rejection" for e in evs)
    criteria = {c["task"]: c for c in [e for e in evs if e["type"] == "VERIFICATION_COMPLETED"][0]["payload"]["criteria"]}
    assert criteria["p4"]["open"] is True and criteria["p2"]["passed"] is True


def test_editing_the_approval_changes_what_is_created(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    edits = {"summary": "Dinner at Luigi's", "start": "2026-10-03T20:00:00+05:30", "end": "2026-10-03T22:00:00+05:30"}
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "edit", "edits": edits})
    event = next(iter(fake.events.values()))
    assert event["summary"] == "Dinner at Luigi's"
    assert event["start"]["dateTime"] == "2026-10-03T20:00:00+05:30"


def test_a_pending_approval_survives_a_restart_and_is_never_auto_approved(tmp_path, fake):
    settings = make_settings(tmp_path, **GOOGLE)
    a = create_app(settings)
    a.state.google.transport = httpx.MockTransport(fake.handler)
    with TestClient(a) as c:
        connect(c, fake)
        mid = start_dinner(c)
    a.state.engine.dispose()

    b = create_app(settings)
    b.state.google.transport = httpx.MockTransport(fake.handler)
    with TestClient(b) as c:
        c.post(f"/api/missions/{mid}/start")  # resuming must not skip the human
        assert c.get(f"/api/missions/{mid}").json()["status"] == "awaiting_approval"
        with b.state.session_factory() as db:
            assert db.query(Approval).one().status == "pending"
    b.state.engine.dispose()
    assert fake.events == {}


def test_a_decision_cannot_be_replayed(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    aid = pending_approval(client, mid)["approval_id"]
    assert client.post(f"/api/approvals/{aid}/decision", json={"decision": "approve"}).status_code == 200
    again = client.post(f"/api/approvals/{aid}/decision", json={"decision": "reject"})
    assert again.status_code == 409 and len(fake.events) == 1


# ---------------------------------------------------------------- failures

def test_revoked_access_surfaces_as_authentication_failed(live, fake):
    app, client = live
    connect(client, fake)
    with app.state.session_factory() as db:  # make the access token look expired
        integ = db.query(Integration).one()
        integ.token_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    fake.refresh_ok = False  # the user revoked AgentOS in their Google account

    mid = start_dinner(client)
    mission = client.get(f"/api/missions/{mid}").json()
    assert mission["status"] == "paused"
    failed = [e for e in events(client, mid) if e["type"] == "TASK_FAILED"][0]["payload"]
    assert failed["error_class"] == "authentication_failed"
    assert "Reconnect Google" in failed["message"]
    assert client.get("/api/integrations").json()[0]["status"] == "needs_reconnect"


def test_an_expired_access_token_is_refreshed_transparently(live, fake):
    app, client = live
    connect(client, fake)
    with app.state.session_factory() as db:
        db.query(Integration).one().token_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    mid = start_dinner(client)
    assert client.get(f"/api/missions/{mid}").json()["status"] == "awaiting_approval"
    assert any(parse_qs(r.content.decode()).get("grant_type") == ["refresh_token"] for r in fake.requests if r.url.path == "/token")


def test_transient_errors_are_retried_at_most_twice_without_duplicates(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    fake.fail_next = [503, 503]
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    assert len(fake.events) == 1
    retries = [e for e in events(client, mid) if e["type"] == "RECOVERY_STARTED"]
    assert [r["payload"]["attempt"] for r in retries] == [2, 3]


def test_a_third_transient_failure_stops_the_mission(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    fake.fail_next = [503, 503, 503]
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    assert client.get(f"/api/missions/{mid}").json()["status"] == "failed"
    failed = [e for e in events(client, mid) if e["type"] == "TASK_FAILED"][0]["payload"]
    assert failed["error_class"] == "service_unavailable" and fake.events == {}


def test_an_event_created_before_a_crash_is_not_created_twice(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    from app.integrations.google import event_id_for
    eid = event_id_for(f"{mid}:p2")
    fake.events[eid] = {"id": eid, "summary": "Birthday dinner for 8", "status": "confirmed", "htmlLink": "https://x/1"}
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    assert len(fake.events) == 1
    p2 = next(t for t in client.get(f"/api/missions/{mid}").json()["tasks"] if t["key"] == "p2")
    assert p2["status"] == "done" and p2["output_summary"]["event_id"] == eid


def test_configured_but_not_connected_asks_to_connect_instead_of_pretending(live, fake):
    _, client = live
    mid = start_dinner(client)
    mission = client.get(f"/api/missions/{mid}").json()
    assert mission["status"] == "paused"
    assert [e for e in events(client, mid) if e["type"] == "TASK_FAILED"][0]["payload"]["error_class"] == "not_connected"
    assert fake.requests == []


def test_permission_off_skips_the_step_and_its_dependants(live, fake):
    _, client = live
    connect(client, fake)
    client.patch("/api/apps/gmail/permissions", json={"actions": {"gmail.create_draft": "off"}})
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    mission = client.get(f"/api/missions/{mid}").json()
    tasks = {t["key"]: t["status"] for t in mission["tasks"]}
    assert tasks["p3"] == "skipped" and tasks["p4"] == "skipped" and mission["status"] == "completed"
    assert fake.drafts == {} and fake.sent == []
    denied = [e for e in events(client, mid) if e["type"] == "TASK_FAILED"][0]["payload"]
    assert denied["error_class"] == "permission_denied"


def test_tool_call_budget_is_enforced(live, fake, monkeypatch):
    _, client = live
    connect(client, fake)
    monkeypatch.setattr(runner, "MAX_TOOL_CALLS_PER_MISSION", 1)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    assert client.get(f"/api/missions/{mid}").json()["status"] == "failed"
    assert [e for e in events(client, mid) if e["type"] == "TASK_FAILED"][0]["payload"]["error_class"] == "budget_exceeded"
    assert fake.events == {}


def test_cancel_closes_pending_approvals(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    aid = pending_approval(client, mid)["approval_id"]
    assert client.post(f"/api/missions/{mid}/cancel").json()["status"] == "cancelled"
    assert client.post(f"/api/approvals/{aid}/decision", json={"decision": "approve"}).status_code == 409
    assert client.post(f"/api/missions/{mid}/start").json()["status"] == "cancelled"
    assert fake.events == {}


# ---------------------------------------------------------------- honesty and secrecy

def test_without_google_every_google_step_is_marked_simulated(client):
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    evs = events(client, mid)
    assert all(e["payload"]["simulated"] is True for e in evs if e["type"] == "TASK_STARTED")
    evidence = client.get(f"/api/missions/{mid}/evidence").json()
    assert evidence and all(e["url"] is None and e["source"] == "simulated" for e in evidence)
    criteria = [e for e in evs if e["type"] == "VERIFICATION_COMPLETED"][0]["payload"]["criteria"]
    assert all(c.get("simulated") for c in criteria)


def test_tools_endpoint_says_what_runs_for_real(client, live):
    assert {t["name"]: t["available"] for t in client.get("/api/tools").json()} == {
        "calendar.create_event": False, "calendar.list_events": False, "gmail.create_draft": False, "gmail.send_draft": False,
        "drive.create_document": False, "drive.get_file": False,
    }
    tools = {t["name"]: t for t in live[1].get("/api/tools").json()}
    assert tools["gmail.send_draft"]["name"] == "gmail.send_draft"
    assert tools["gmail.send_draft"]["capability"] == "communication"
    assert tools["gmail.send_draft"]["risk"] == "HIGH"
    assert tools["gmail.send_draft"]["available"] == False


def test_tokens_never_appear_in_responses_events_or_logs(live, fake, caplog):
    _, client = live
    caplog.set_level(logging.DEBUG)
    connect(client, fake)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    seen = json.dumps([
        client.get("/api/integrations").json(), client.get(f"/api/missions/{mid}").json(), events(client, mid),
        client.get(f"/api/missions/{mid}/evidence").json(), client.get(f"/api/missions/{mid}/proof").json(), client.get("/api/health").json(),
    ]) + client.get(f"/api/missions/{mid}/stream").text + caplog.text
    assert fake.issued and not any(t in seen for t in fake.issued)
    assert "shh-client-secret" not in seen


def test_proof_bundle_and_reverification_on_demand(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)

    # Approve Calendar and Gmail send
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})

    # Check proof bundle via both /api and /api/v1
    for prefix in ("/api", "/api/v1"):
        proof = client.get(f"{prefix}/missions/{mid}/proof").json()
        assert "criteria" in proof
        assert len(proof["criteria"]) >= 1
        criterion = proof["criteria"][0]
        assert criterion["status"] == "verified"
        assert len(criterion["evidence"]) >= 2
        for ev in criterion["evidence"]:
            assert ev["status"] == "verified"
            assert ev["verified_at"] is not None
            assert ev["method"] is not None
            assert "reference_id" in ev

    # Re-verify on demand against real app: everything still intact
    reverify_res = client.post(f"/api/missions/{mid}/verify").json()
    assert reverify_res["criteria"][0]["status"] == "verified"

    # Now simulate deleting the event in Google Calendar
    fake.events.clear()

    # Re-verify on demand: must mark the deleted event failed and criterion turns open
    reverify_after_delete = client.post(f"/api/missions/{mid}/verify").json()
    crit_after = reverify_after_delete["criteria"][0]
    assert crit_after["status"] == "open"
    cal_ev = next(e for e in crit_after["evidence"] if e["type"] == "calendar_event")
    assert cal_ev["status"] == "failed"
    assert "not found" in cal_ev["method"].lower() or "missing" in cal_ev["method"].lower()

    # Proof bundle GET reflects the updated state
    proof_after = client.get(f"/api/missions/{mid}/proof").json()
    assert proof_after["criteria"][0]["status"] == "open"


def test_proof_bundle_with_rejected_step(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)

    # Approve event, reject send
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "reject"})

    proof = client.get(f"/api/missions/{mid}/proof").json()
    assert any(c["status"] == "open" for c in proof["criteria"])

