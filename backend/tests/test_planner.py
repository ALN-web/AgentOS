from unittest.mock import patch
import pytest
from app.db.models import User
from app.schemas.plan import MissionPlan
from app.services.planner import AnthropicPlanner
from fastapi.testclient import TestClient

def test_planner_llm_success(app):
    with app.state.session_factory() as db_session:
        user = User(email="test@test.com")
        db_session.add(user)
        db_session.commit()
        
        valid_plan_json = """{
          "kind": "dynamic",
          "goal": "Test goal",
          "intent": {"objective": "Test", "domain": "General", "desiredOutcome": "Done"},
          "tasks": [
            {
              "id": "t1",
              "title": "Task 1",
              "agent": "browser",
              "capability": "browser",
              "inputs": {}
            }
          ],
          "criteria": [],
          "metric": {"kind": "criteria", "label": "success", "target": 1},
          "approvalPoints": 0,
          "capabilities": ["browser"]
        }"""
        
        with patch.object(AnthropicPlanner, "_call_llm", return_value=valid_plan_json):
            planner = AnthropicPlanner()
            plan = planner.plan("Test goal", {}, db_session, user)
            assert plan is not None
            assert plan.kind == "dynamic"
            assert plan.goal == "Test goal"
            assert len(plan.tasks) == 1

def test_planner_invalid_then_repair_success(app):
    with app.state.session_factory() as db_session:
        user = User(email="test@test.com")
        db_session.add(user)
        db_session.commit()
        
        invalid_plan_json = '{"kind": "dynamic"}' # Missing required fields
        valid_plan_json = """{
          "kind": "dynamic",
          "goal": "Test goal repaired",
          "intent": {"objective": "Test", "domain": "General", "desiredOutcome": "Done"},
          "tasks": [{"id": "t1", "title": "Task 1", "agent": "browser", "capability": "browser", "inputs": {}}],
          "criteria": [],
          "metric": {"kind": "criteria", "label": "success", "target": 1},
          "approvalPoints": 0,
          "capabilities": ["browser"]
        }"""
        
        responses = [invalid_plan_json, valid_plan_json]
        def mock_call_llm(prompt, system):
            return responses.pop(0) if responses else None

        with patch.object(AnthropicPlanner, "_call_llm", side_effect=mock_call_llm):
            planner = AnthropicPlanner()
            plan = planner.plan("Test goal", {}, db_session, user)
            assert plan is not None
            assert plan.goal == "Test goal repaired"

def test_planner_repair_failure(app):
    with app.state.session_factory() as db_session:
        user = User(email="test@test.com")
        db_session.add(user)
        db_session.commit()
        
        invalid_plan_json = '{"kind": "dynamic"}'
        
        with patch.object(AnthropicPlanner, "_call_llm", return_value=invalid_plan_json):
            planner = AnthropicPlanner()
            plan = planner.plan("Test goal", {}, db_session, user)
            assert plan is None

def test_analyze_endpoint_llm_success(client: TestClient):
    # Test POST /api/missions/analyze
    valid_plan_json = """{
      "kind": "dynamic",
      "goal": "Test goal",
      "intent": {"objective": "Test", "domain": "General", "desiredOutcome": "Done"},
      "tasks": [{"id": "t1", "title": "Task 1", "agent": "browser", "capability": "browser", "inputs": {}}],
      "criteria": [],
      "metric": {"kind": "criteria", "label": "success", "target": 1},
      "approvalPoints": 0,
      "capabilities": ["browser"]
    }"""
    
    with patch.object(AnthropicPlanner, "_call_llm", return_value=valid_plan_json):
        res = client.post("/api/missions/analyze", json={"goal": "Test goal"})
        assert res.status_code == 200
        data = res.json()
        assert data["planner"] == "llm"
        assert data["plan"] is not None

def test_analyze_endpoint_fallback(client: TestClient):
    # Test POST /api/missions/analyze
    with patch.object(AnthropicPlanner, "_call_llm", return_value=None):
        res = client.post("/api/missions/analyze", json={"goal": "Test goal"})
        assert res.status_code == 200
        data = res.json()
        assert data["planner"] == "fallback"
        assert data["plan"] is None
