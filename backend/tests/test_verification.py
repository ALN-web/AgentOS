"""Tests for proof bundle and independent re-verification (#14)."""

import pytest
from app.db.models import Evidence, Mission, Task
from tests.test_cross_app import _make_cross_app_plan


def test_proof_bundle_schema_and_status(client):
    plan_data = _make_cross_app_plan()
    res = client.post("/api/missions", json=plan_data)
    assert res.status_code == 201
    mid = res.json()["id"]

    # Before execution: criterion is open
    proof = client.get(f"/api/missions/{mid}/proof").json()
    assert "criteria" in proof
    assert len(proof["criteria"]) == 1
    assert proof["criteria"][0]["status"] == "open"
    assert proof["criteria"][0]["label"] == "Calendar event and invitation email verified"
    assert proof["criteria"][0]["evidence"] == []

    # Also test via /api/v1
    proof_v1 = client.get(f"/api/v1/missions/{mid}/proof").json()
    assert proof_v1 == proof

    # Start mission (runs in simulated mode locally without real Google credentials)
    start_res = client.post(f"/api/missions/{mid}/start")
    assert start_res.status_code == 200

    # In simulated mode, p2 is gated with approval
    appr = client.get(f"/api/missions/{mid}/events").json()
    approval_events = [e for e in appr if e["type"] == "APPROVAL_REQUESTED"]
    assert len(approval_events) > 0
    appr_id = approval_events[0]["payload"]["approval_id"]
    client.post(f"/api/approvals/{appr_id}/decision", json={"decision": "approve"})

    # Next approval (p4)
    appr2 = client.get(f"/api/missions/{mid}/events").json()
    approval_events2 = [e for e in appr2 if e["type"] == "APPROVAL_REQUESTED"]
    appr_id2 = approval_events2[-1]["payload"]["approval_id"]
    client.post(f"/api/approvals/{appr_id2}/decision", json={"decision": "approve"})

    # Mission completed
    mission_detail = client.get(f"/api/missions/{mid}").json()
    assert mission_detail["status"] == "completed"

    # Evidence endpoint includes status, verified_at, method
    evidence_list = client.get(f"/api/missions/{mid}/evidence").json()
    assert len(evidence_list) > 0
    for ev in evidence_list:
        assert "status" in ev
        assert "verified_at" in ev
        assert "method" in ev
        assert ev["status"] == "verified"

    # Proof bundle after completion has verified criteria and evidence
    proof_done = client.get(f"/api/missions/{mid}/proof").json()
    assert proof_done["criteria"][0]["status"] == "verified"
    assert len(proof_done["criteria"][0]["evidence"]) >= 2
    for ev in proof_done["criteria"][0]["evidence"]:
        assert ev["status"] == "verified"
        assert ev["verified_at"] is not None

    # Re-verify on demand via POST /api/missions/{mid}/verify
    reverify_res = client.post(f"/api/missions/{mid}/verify").json()
    assert "criteria" in reverify_res
    assert reverify_res["criteria"][0]["status"] == "verified"

    # POST via /api/v1/missions/{mid}/verify
    reverify_v1 = client.post(f"/api/v1/missions/{mid}/verify").json()
    assert reverify_v1 == reverify_res


def test_proof_and_verify_404_for_missing_mission(client):
    res_get = client.get("/api/missions/nonexistent_id/proof")
    assert res_get.status_code == 404

    res_post = client.post("/api/missions/nonexistent_id/verify")
    assert res_post.status_code == 404
