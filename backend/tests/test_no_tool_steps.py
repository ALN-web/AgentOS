"""Steps without a real tool run as marked simulations, also in Live Mode (regression from #71)."""

import copy

from tests.test_cross_app import _make_cross_app_plan
from tests.test_google_live import _no_backoff, connect, events, fake, live, pending_approval  # noqa: F401  (fixtures)


def plan_with_research_step():
    req = copy.deepcopy(_make_cross_app_plan())
    # The rule-based planner's typical first step: research with no tool and no inputs.
    req["plan"]["tasks"][0].update({"title": "Research options", "capability": "search", "type": "search", "inputs": {}})
    req["plan"]["tasks"][1]["inputs"].update({"start": "2026-10-03T19:00:00+05:30", "end": "2026-10-03T21:00:00+05:30"})
    return req


def test_a_step_without_a_tool_is_simulated_and_the_mission_continues(live, fake):
    _, client = live
    connect(client, fake)
    mid = client.post("/api/missions", json=plan_with_research_step()).json()["id"]
    client.post(f"/api/missions/{mid}/start")
    mission = client.get(f"/api/missions/{mid}").json()
    tasks = {t["key"]: t["status"] for t in mission["tasks"]}
    assert tasks["p1"] == "done" and mission["status"] == "awaiting_approval"
    started = [e["payload"] for e in events(client, mid) if e["type"] == "TASK_STARTED"]
    assert started[0] == {"task_key": "p1", "simulated": True}
    assert not any(e["type"] == "TASK_FAILED" for e in events(client, mid))


def test_an_invented_tool_name_is_never_run_for_real(live, fake):
    _, client = live
    connect(client, fake)
    req = plan_with_research_step()
    req["plan"]["tasks"][0]["inputs"] = {"tool": "web.teleport"}
    mid = client.post("/api/missions", json=req).json()["id"]
    client.post(f"/api/missions/{mid}/start")
    assert {t["key"]: t["status"] for t in client.get(f"/api/missions/{mid}").json()["tasks"]}["p1"] == "done"
    assert [e["payload"]["simulated"] for e in events(client, mid) if e["type"] == "TASK_STARTED"][0] is True
