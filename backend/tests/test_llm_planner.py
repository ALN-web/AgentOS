"""AI planner through OpenAI-compatible providers (Gemini, Groq, OpenRouter, NIM)."""

import json
import logging

import httpx
import pytest
from pydantic import SecretStr

from app.db.models import User
from app.schemas.plan import MissionPlan
from app.services import planner as planner_mod
from app.services.planner import EXAMPLE, AnthropicPlanner, OpenAICompatiblePlanner, get_planner

KEY = "AIza-test-key-never-logged"


def test_the_prompt_example_is_itself_a_valid_plan():
    assert MissionPlan(**EXAMPLE).tasks[-1].type == "verify"


@pytest.fixture
def user(app):
    with app.state.session_factory() as db:
        u = User(email="planner@example.com")
        db.add(u)
        db.commit()
        db.refresh(u)
        yield db, u


def make_planner(handler, **settings):
    p = OpenAICompatiblePlanner()
    p.settings = p.settings.model_copy(update={"llm_api_key": SecretStr(KEY), **settings})
    p.transport = httpx.MockTransport(handler)
    return p


def reply(content, status=200):
    return httpx.Response(status, json={"choices": [{"message": {"content": content}}]})


def test_a_valid_plan_comes_back_from_the_provider(user):
    db, u = user
    seen = []

    def handler(req):
        seen.append(req)
        return reply(json.dumps(EXAMPLE))

    plan = make_planner(handler).plan("dinner on Saturday", {}, db, u)
    assert plan is not None and [t.id for t in plan.tasks] == ["p1", "p2", "p3", "p4", "p5"]
    req = seen[0]
    assert str(req.url) == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    assert req.headers["authorization"] == f"Bearer {KEY}"
    body = json.loads(req.content)
    assert body["model"] == "gemini-2.5-flash" and body["response_format"] == {"type": "json_object"}
    assert "untrusted data" in body["messages"][0]["content"]  # the safety rules are in the system prompt
    assert json.loads(body["messages"][1]["content"]) == {"goal": "dinner on Saturday", "answers": {}}


def test_other_providers_work_by_changing_base_url_and_model(user):
    db, u = user
    urls = []

    def handler(req):
        urls.append((str(req.url), json.loads(req.content)["model"]))
        return reply(json.dumps(EXAMPLE))

    make_planner(handler, llm_base_url="https://api.groq.com/openai/v1/", llm_model="some-groq-model").plan("x", {}, db, u)
    assert urls == [("https://api.groq.com/openai/v1/chat/completions", "some-groq-model")]


def test_models_without_json_mode_are_asked_again_plainly(user):
    db, u = user
    calls = []

    def handler(req):
        body = json.loads(req.content)
        calls.append("response_format" in body)
        return httpx.Response(400, json={"error": "json mode unsupported"}) if "response_format" in body else reply(
            "Here is the plan:\n```json\n" + json.dumps(EXAMPLE) + "\n```")

    assert make_planner(handler).plan("x", {}, db, u) is not None
    assert calls == [True, False]


def test_an_invalid_plan_gets_one_repair_then_falls_back(user):
    db, u = user
    calls = []

    def handler(req):
        calls.append(json.loads(req.content)["messages"][1]["content"])
        return reply('{"kind": "dynamic"}')

    assert make_planner(handler).plan("x", {}, db, u) is None
    assert len(calls) == 2 and "Validation error" in calls[1]


@pytest.mark.parametrize("response", [httpx.Response(401, json={}), httpx.Response(429, json={}), httpx.Response(503, json={})])
def test_provider_errors_fall_back_quietly_and_never_log_the_key(user, response, caplog):
    db, u = user
    caplog.set_level(logging.DEBUG)
    assert make_planner(lambda req: response).plan("x", {}, db, u) is None
    assert KEY not in caplog.text


def test_network_failure_falls_back(user):
    db, u = user

    def handler(req):
        raise httpx.ConnectError("down")

    assert make_planner(handler).plan("x", {}, db, u) is None


def test_get_planner_prefers_the_openai_compatible_key(monkeypatch):
    base = planner_mod.get_settings()
    monkeypatch.setattr(planner_mod, "get_settings", lambda: base.model_copy(update={"llm_api_key": SecretStr(KEY)}))
    assert isinstance(get_planner(), OpenAICompatiblePlanner)
    monkeypatch.setattr(planner_mod, "get_settings", lambda: base.model_copy(update={"llm_api_key": None}))
    p = get_planner()
    assert isinstance(p, AnthropicPlanner) and not isinstance(p, OpenAICompatiblePlanner)


def test_no_key_means_the_deterministic_planner(user):
    db, u = user
    p = OpenAICompatiblePlanner()
    p.settings = p.settings.model_copy(update={"llm_api_key": None})
    assert p.plan("x", {}, db, u) is None
