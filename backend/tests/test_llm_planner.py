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
    assert body["model"] == "gemini-3.1-flash-lite" and body["response_format"] == {"type": "json_object"}
    assert "untrusted data" in body["messages"][0]["content"]  # the safety rules are in the system prompt
    assert json.loads(body["messages"][1]["content"]) == {"goal": "dinner on Saturday", "answers": {}}


def test_other_providers_work_by_changing_base_url_and_model(user):
    db, u = user
    urls = []

    def handler(req):
        urls.append((str(req.url), json.loads(req.content)["model"]))
        return reply(json.dumps(EXAMPLE))

    make_planner(handler, llm_base_url="https://api.groq.com/openai/v1/", llm_model="some-groq-model", llm_fallback_models="").plan("x", {}, db, u)
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


def test_a_send_step_gets_the_draft_wired_in(user):
    db, u = user
    plan = json.loads(json.dumps(EXAMPLE))
    del plan["tasks"][3]["inputs"]["draft_id"]  # what free models often produce
    out = make_planner(lambda req: reply(json.dumps(plan))).plan("x", {}, db, u)
    send = next(t for t in out.tasks if t.id == "p4")
    assert send.inputs["draft_id"] == "p3.output.draft_id"


def test_wiring_leaves_complete_or_unrelated_plans_alone():
    from app.services.planner import wire_send_to_draft
    plan = json.loads(json.dumps(EXAMPLE))
    assert wire_send_to_draft(json.loads(json.dumps(plan))) == plan
    lone = {"tasks": [{"id": "s", "capability": "communication", "deps": [], "inputs": {}}]}
    assert wire_send_to_draft(lone)["tasks"][0]["inputs"] == {}


@pytest.mark.parametrize("first", [httpx.Response(429, json={}), httpx.Response(503, json={})])
def test_a_rate_limited_or_overloaded_model_falls_through_to_the_next(user, first):
    db, u = user
    models = []

    def handler(req):
        models.append(json.loads(req.content)["model"])
        return first if len(models) == 1 else reply(json.dumps(EXAMPLE))

    plan = make_planner(handler, llm_model="model-a", llm_fallback_models="model-b, model-c").plan("x", {}, db, u)
    assert plan is not None and models == ["model-a", "model-b"]


def test_a_bad_key_does_not_cycle_through_every_model(user):
    db, u = user
    models = []

    def handler(req):
        models.append(json.loads(req.content)["model"])
        return httpx.Response(401, json={})

    assert make_planner(handler, llm_model="model-a", llm_fallback_models="model-b").plan("x", {}, db, u) is None
    assert models == ["model-a"]


GROQ_KEY = "gsk-test-key-never-logged"


def two_providers(handler, **settings):
    return make_planner(handler, llm_model="gemini-a", llm_fallback_models="gemini-b",
                        llm_fallback_api_key=SecretStr(GROQ_KEY), llm_fallback_provider_models="groq-a,groq-b", **settings)


@pytest.mark.parametrize("gemini_status", [429, 503, 401])
def test_when_gemini_is_unavailable_the_second_provider_plans(user, gemini_status, caplog):
    db, u = user
    caplog.set_level(logging.DEBUG)
    seen = []

    def handler(req):
        seen.append((req.url.host, json.loads(req.content)["model"], req.headers["authorization"]))
        if req.url.host == "generativelanguage.googleapis.com":
            return httpx.Response(gemini_status, json={})
        return reply(json.dumps(EXAMPLE))

    plan = two_providers(handler).plan("x", {}, db, u)
    assert plan is not None
    groq = [s for s in seen if s[0] == "api.groq.com"]
    assert groq[0] == ("api.groq.com", "groq-a", f"Bearer {GROQ_KEY}")
    assert all(s[2] == f"Bearer {KEY}" for s in seen if s[0] != "api.groq.com")  # each key only to its own provider
    assert KEY not in caplog.text and GROQ_KEY not in caplog.text


def test_the_second_provider_is_not_called_when_gemini_answers(user):
    db, u = user
    hosts = []

    def handler(req):
        hosts.append(req.url.host)
        return reply(json.dumps(EXAMPLE))

    assert two_providers(handler).plan("x", {}, db, u) is not None
    assert hosts == ["generativelanguage.googleapis.com"]


def test_a_retired_model_is_skipped(user):
    db, u = user
    models = []

    def handler(req):
        models.append(json.loads(req.content)["model"])
        return httpx.Response(404, json={}) if len(models) < 4 else reply(json.dumps(EXAMPLE))

    assert two_providers(handler).plan("x", {}, db, u) is not None
    assert models == ["gemini-a", "gemini-b", "groq-a", "groq-b"]


def test_everything_down_falls_back_to_the_rule_based_planner(user):
    db, u = user
    assert two_providers(lambda req: httpx.Response(503, json={})).plan("x", {}, db, u) is None


def test_slow_gemini_still_leaves_time_for_the_second_provider(user, monkeypatch):
    db, u = user
    clock = [0.0]
    monkeypatch.setattr(planner_mod.time, "monotonic", lambda: clock[0])
    hosts = []

    def handler(req):
        hosts.append(req.url.host)
        if req.url.host == "generativelanguage.googleapis.com":
            clock[0] += req.extensions["timeout"]["read"]  # Gemini hangs until the attempt times out
            raise httpx.ReadTimeout("slow")
        return reply(json.dumps(EXAMPLE))

    assert two_providers(handler).plan("x", {}, db, u) is not None
    assert hosts[0] == "generativelanguage.googleapis.com" and hosts[-1] == "api.groq.com"
    assert clock[0] <= 28  # within the overall planning budget


def test_only_a_fallback_key_still_uses_the_ai_planner(monkeypatch, user):
    db, u = user
    base = planner_mod.get_settings()
    monkeypatch.setattr(planner_mod, "get_settings", lambda: base.model_copy(
        update={"llm_api_key": None, "llm_fallback_api_key": SecretStr(GROQ_KEY)}))
    p = get_planner()
    assert isinstance(p, OpenAICompatiblePlanner)
    hosts = []
    p.transport = httpx.MockTransport(lambda req: hosts.append(req.url.host) or reply(json.dumps(EXAMPLE)))
    assert p.plan("x", {}, db, u) is not None and hosts == ["api.groq.com"]
