"""Tests for Cross-App Missions (Issue #12):
- Data passing between tasks (references: <dep_id>.output.<field>)
- Plan validation: non-dependencies, unknown fields, cycles, secrets/tokens rejected (422)
- End-to-end reference mission with Calendar and Gmail tools
- Partial failure and idempotency: earlier real actions are not duplicated
- Redacted outputs in TOOL_COMPLETED events and GET /api/missions/{id}
"""

import pytest
from app.db.models import Mission
from app.domain import RiskLevel
from app.tools.fake import FakeTool
from app.tools.registry import register_tool, unregister_tool


def _make_cross_app_plan():
    return {
        "goal": "Organise a birthday dinner for 8 on Saturday and invite guest@example.com",
        "plan": {
            "kind": "dynamic",
            "goal": "Organise a birthday dinner for 8 on Saturday and invite guest@example.com",
            "intent": {
                "objective": "Organise a birthday dinner for 8 on Saturday and invite guest@example.com",
                "domain": "personal",
                "desiredOutcome": "Calendar event created and invitation sent",
            },
            "tasks": [
                {
                    "id": "p1",
                    "title": "Find suitable time",
                    "agent": "browser",
                    "type": "search",
                    "capability": "search",
                    "deps": [],
                    "gated": False,
                    "inputs": {"query": "Saturday"},
                },
                {
                    "id": "p2",
                    "title": "Create calendar event",
                    "agent": "execution",
                    "type": "schedule",
                    "capability": "calendar",
                    "deps": ["p1"],
                    "gated": True,
                    "inputs": {
                        "summary": "Birthday dinner for 8",
                        "start": "p1.output.start",
                        "end": "p1.output.end",
                    },
                },
                {
                    "id": "p3",
                    "title": "Create invitation draft",
                    "agent": "execution",
                    "type": "draft",
                    "capability": "document",
                    "deps": ["p2"],
                    "gated": False,
                    "inputs": {
                        "to": "guest@example.com",
                        "subject": "Birthday dinner for 8",
                        "body_link": "p2.output.html_link",
                    },
                },
                {
                    "id": "p4",
                    "title": "Send invitation",
                    "agent": "execution",
                    "type": "communicate",
                    "capability": "communication",
                    "deps": ["p3"],
                    "gated": True,
                    "inputs": {
                        "draft_id": "p3.output.draft_id",
                        "message_id": "p3.output.message_id",
                    },
                },
                {
                    "id": "p5",
                    "title": "Verify event and email",
                    "agent": "verification",
                    "type": "verify",
                    "capability": "verification",
                    "deps": ["p4", "p2"],
                    "gated": False,
                    "inputs": {},
                    "criterion": "Calendar event and invitation email verified",
                },
            ],
            "criteria": [
                {"label": "Calendar event and invitation email verified", "taskId": "p5"}
            ],
            "metric": {
                "kind": "criteria",
                "label": "Success criteria met",
                "target": 1,
            },
            "approvalPoints": 2,
            "capabilities": ["search", "calendar", "document", "communication", "verification", "approval"],
        },
    }


# ----------------------------------------------------------------- Validation Tests

def test_invalid_reference_to_non_dependency_rejected(client):
    req = _make_cross_app_plan()
    # Task p3 references p1, but only depends on p2
    req["plan"]["tasks"][2]["inputs"]["other_link"] = "p1.output.start"
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    assert "not in its dependencies" in res.text


def test_invalid_reference_unknown_output_field_rejected(client):
    req = _make_cross_app_plan()
    # Task p3 references unknown output field 'nonexistent_field_xyz' from p2
    req["plan"]["tasks"][2]["inputs"]["body_link"] = "p2.output.nonexistent_field_xyz"
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    assert "unknown output field" in res.text


def test_invalid_reference_cycle_rejected(client):
    req = _make_cross_app_plan()
    # Create cycle: p1 depends on p4
    req["plan"]["tasks"][0]["deps"].append("p4")
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    assert "cycle" in res.text


def test_invalid_reference_to_self_rejected(client):
    req = _make_cross_app_plan()
    # Task p2 references its own output
    req["plan"]["tasks"][1]["inputs"]["self_link"] = "p2.output.html_link"
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    assert "cannot reference its own output" in res.text


@pytest.mark.parametrize(
    "bad_inputs",
    [
        {"token": "secret_token_123"},
        {"access_token": "abc"},
        {"api_key": "12345"},
        {"password": "pass"},
        {"secret": "my-secret"},
        {"credential": "creds"},
        {"auth": "bearer my_token_string"},
        {"link": "p1.output.token"},
        {"link": "p1.output.secret"},
    ],
)
def test_secrets_and_tokens_cannot_be_passed_or_referenced(client, bad_inputs):
    req = _make_cross_app_plan()
    req["plan"]["tasks"][0]["inputs"].update(bad_inputs)
    res = client.post("/api/missions", json=req)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
    assert "secrets and tokens" in res.text


# ----------------------------------------------------------------- End-to-End Reference Mission

def test_reference_mission_runs_end_to_end_with_data_passing(client):
    req = _make_cross_app_plan()
    create_res = client.post("/api/missions", json=req)
    assert create_res.status_code == 201
    mission = create_res.json()
    mid = mission["id"]

    # 1. Start the mission: runs p1, then stops at gated p2 (Create calendar event)
    start_res = client.post(f"/api/missions/{mid}/start")
    assert start_res.status_code == 200
    m_state = start_res.json()
    assert m_state["status"] == "awaiting_approval"

    # Verify p1 completed and has output
    p1 = next(t for t in m_state["tasks"] if t["key"] == "p1")
    assert p1["status"] == "done"
    assert p1["output_summary"] is not None
    assert "free_slots" in p1["output_summary"]

    # Verify p2 is awaiting approval
    p2 = next(t for t in m_state["tasks"] if t["key"] == "p2")
    assert p2["status"] == "awaiting"

    # Find the pending approval for p2
    events = client.get(f"/api/missions/{mid}/events").json()
    appr_events = [e for e in events if e["type"] == "APPROVAL_REQUESTED"]
    assert len(appr_events) == 1
    appr_p2_id = appr_events[0]["payload"]["approval_id"]
    assert appr_events[0]["payload"]["task_key"] == "p2"

    # 2. Approve calendar event creation
    dec_res1 = client.post(f"/api/approvals/{appr_p2_id}/decision", json={"decision": "approve"})
    assert dec_res1.status_code == 200
    assert dec_res1.json()["status"] == "approved"

    # The mission automatically resumed!
    # p2 succeeded (created event with html_link).
    # p3 (draft) ran automatically: resolved p2.output.html_link into body_link!
    # p4 (send) is gated and is now awaiting approval.
    m_state2 = client.get(f"/api/missions/{mid}").json()
    assert m_state2["status"] == "awaiting_approval"

    p2_updated = next(t for t in m_state2["tasks"] if t["key"] == "p2")
    assert p2_updated["status"] == "done"
    real_event_link = p2_updated["output_summary"]["html_link"]
    assert "https://calendar.google.com" in real_event_link

    p3_updated = next(t for t in m_state2["tasks"] if t["key"] == "p3")
    assert p3_updated["status"] == "done"
    # p3's inputs resolved the event link!
    assert p3_updated["inputs"]["body_link"] == real_event_link
    # p3's draft body contains the real event link!
    assert real_event_link in p3_updated["output_summary"]["body"]

    # 3. Find approval for p4 (Send invitation)
    events2 = client.get(f"/api/missions/{mid}/events").json()
    appr_events2 = [e for e in events2 if e["type"] == "APPROVAL_REQUESTED"]
    assert len(appr_events2) == 2
    appr_p4_id = appr_events2[1]["payload"]["approval_id"]
    assert appr_events2[1]["payload"]["task_key"] == "p4"

    # Approve sending the email
    dec_res2 = client.post(f"/api/approvals/{appr_p4_id}/decision", json={"decision": "approve"})
    assert dec_res2.status_code == 200
    assert dec_res2.json()["status"] == "approved"

    # 4. Mission finishes completely: p4 sent, p5 verified both!
    final_mission = client.get(f"/api/missions/{mid}").json()
    assert final_mission["status"] == "completed"

    for t in final_mission["tasks"]:
        assert t["status"] == "done"
        assert t["output_summary"] is not None

    p5 = next(t for t in final_mission["tasks"] if t["key"] == "p5")
    assert p5["output_summary"]["verified"] is True

    # 5. Check event log: TOOL_COMPLETED includes output, verification events present
    final_events = client.get(f"/api/missions/{mid}/events").json()
    tool_completed = [e for e in final_events if e["type"] == "TOOL_COMPLETED"]
    assert len(tool_completed) >= 4
    for tc in tool_completed:
        assert "output" in tc["payload"]
        assert isinstance(tc["payload"]["output"], dict)

    # Check that draft TOOL_COMPLETED has output containing the event link
    draft_event = next(e for e in tool_completed if e["payload"]["task_key"] == "p3")
    assert real_event_link in draft_event["payload"]["output"]["body"]

    event_types = [e["type"] for e in final_events]
    assert "VERIFICATION_STARTED" in event_types
    assert "VERIFICATION_COMPLETED" in event_types
    assert "MISSION_COMPLETED" in event_types


# ----------------------------------------------------------------- Partial Failure & Idempotency

def test_partial_failure_does_not_duplicate_earlier_real_actions(client):
    tool1 = FakeTool("fake.step1", capability="document", risk=RiskLevel.LOW)
    tool2 = FakeTool("fake.step2", capability="document", risk=RiskLevel.LOW)
    tool2.set_fail_times(1)  # Will fail on first attempt

    register_tool(tool1)
    register_tool(tool2)

    try:
        req = {
            "goal": "Test partial failure and recovery",
            "plan": {
                "kind": "dynamic",
                "goal": "Test partial failure and recovery",
                "intent": {
                    "objective": "Test partial failure and recovery",
                    "domain": "personal",
                    "desiredOutcome": "Recover without duplicate",
                },
                "tasks": [
                    {
                        "id": "t1",
                        "title": "First action",
                        "agent": "execution",
                        "type": "draft",
                        "capability": "document",
                        "deps": [],
                        "gated": False,
                        "inputs": {"tool": "fake.step1", "arg": "hello"},
                    },
                    {
                        "id": "t2",
                        "title": "Second action",
                        "agent": "execution",
                        "type": "draft",
                        "capability": "document",
                        "deps": ["t1"],
                        "gated": False,
                        "inputs": {"tool": "fake.step2", "val": "t1.output.result"},
                    },
                ],
                "criteria": [],
                "metric": {"kind": "criteria", "label": "done", "target": 1},
                "approvalPoints": 0,
                "capabilities": ["document"],
            },
        }

        res = client.post("/api/missions", json=req)
        assert res.status_code == 201
        mid = res.json()["id"]

        # Run 1: t1 succeeds, t2 fails
        start_res1 = client.post(f"/api/missions/{mid}/start")
        assert start_res1.status_code == 200
        state1 = start_res1.json()
        assert state1["status"] == "failed"

        t1_state1 = next(t for t in state1["tasks"] if t["key"] == "t1")
        t2_state1 = next(t for t in state1["tasks"] if t["key"] == "t2")
        assert t1_state1["status"] == "done"
        assert t2_state1["status"] == "failed"

        # Check call counts: tool1 ran once, tool2 ran once (and failed)
        assert tool1.call_count == 1
        assert tool2.call_count == 1

        # Run 2: Resume / retry mission
        # Since t1 was already done, it MUST NOT be called again!
        start_res2 = client.post(f"/api/missions/{mid}/start")
        assert start_res2.status_code == 200
        state2 = start_res2.json()
        assert state2["status"] == "completed"

        # Verification: tool1 was NOT executed a second time!
        assert tool1.call_count == 1
        # tool2 was retried and succeeded
        assert tool2.call_count == 2
        # Data was passed correctly from t1's existing output to t2!
        assert tool2.calls[1][1]["val"] == "ok_fake.step1"

    finally:
        unregister_tool("fake.step1")
        unregister_tool("fake.step2")
