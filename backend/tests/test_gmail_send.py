"""Gmail via gmail.send (#37): the approval shows what is sent; an unconfirmed send is never repeated."""

from email import message_from_string
from email.policy import default
from urllib.parse import parse_qs, urlparse

from tests.test_google_live import _no_backoff, connect, events, fake, live, pending_approval, start_dinner  # noqa: F401  (fixtures)


def test_connect_asks_for_gmail_send_not_the_restricted_compose_scope(live):
    url = live[1].post("/api/integrations/google/connect").json()["authorization_url"]
    scopes = parse_qs(urlparse(url).query)["scope"][0].split()
    assert "https://www.googleapis.com/auth/gmail.send" in scopes
    assert "https://www.googleapis.com/auth/gmail.compose" not in scopes


def test_send_approval_shows_recipient_subject_and_text(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    send = pending_approval(client, mid)
    assert send["task_key"] == "p4"
    payload = send["payload"]
    assert payload["to"] == "guest@example.com" and payload["subject"] == "Birthday dinner for 8"
    assert "calendar/event?eid=" in payload["body"]  # the real event link is in the text being approved
    assert fake.sent == []  # nothing left before approval

    client.post(f"/api/approvals/{send['approval_id']}/decision", json={"decision": "approve"})
    email = message_from_string(fake.sent[0]["raw"], policy=default)
    assert email["To"] == "guest@example.com" and email["Subject"] == "Birthday dinner for 8"
    assert email.get_content().strip() == payload["body"].strip()  # exactly what was approved


def test_editing_the_email_in_the_approval_changes_what_is_sent(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    aid = pending_approval(client, mid)["approval_id"]
    client.post(f"/api/approvals/{aid}/decision", json={"decision": "edit", "edits": {"subject": "Dinner moved to 8 pm"}})
    assert message_from_string(fake.sent[0]["raw"], policy=default)["Subject"] == "Dinner moved to 8 pm"


def test_an_unconfirmed_send_is_never_retried(live, fake):
    _, client = live
    connect(client, fake)
    mid = start_dinner(client)
    client.post(f"/api/approvals/{pending_approval(client, mid)['approval_id']}/decision", json={"decision": "approve"})
    aid = pending_approval(client, mid)["approval_id"]
    fake.fail_next = [503]  # Gmail may or may not have sent it
    client.post(f"/api/approvals/{aid}/decision", json={"decision": "approve"})
    sends = [r for r in fake.requests if r.url.path == "/gmail/v1/users/me/messages/send"]
    assert len(sends) == 1  # one attempt only, no automatic resend
    failed = [e for e in events(client, mid) if e["type"] == "TASK_FAILED"][-1]["payload"]
    assert failed["error_class"] == "send_unconfirmed" and "Sent folder" in failed["message"]
