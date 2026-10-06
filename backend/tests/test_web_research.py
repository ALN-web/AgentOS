"""Real web research (#53): a completely different goal runs through the same engine."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.main import create_app
from app.tools.base import ToolContext
from app.tools.registry import get_tool
from app.tools.web import WebSearchTool
from tests.conftest import make_settings

GEMINI_KEY = "AIza-search-key-never-logged"
GOAL = "Find me 20 suitable internship opportunities in software engineering"


def grounded(text="* Acme runs a summer internship.", uris=("https://acme.example/jobs", "https://jobs.example/intern")):
    return httpx.Response(200, json={"candidates": [{
        "content": {"parts": [{"text": text}]},
        "groundingMetadata": {
            "groundingChunks": [{"web": {"uri": u, "title": u.split("//")[-1]}} for u in uris],
            "groundingSupports": [{"segment": {"text": "Acme runs a summer internship."}, "groundingChunkIndices": [0]}],
        },
    }]})


WIKI = httpx.Response(200, json={"query": {"search": [
    {"title": "Internship", "snippet": "An <span class=\"searchmatch\">internship</span> is a period of work"},
]}})


class Net:
    def __init__(self, gemini=None, wiki=WIKI):
        self.gemini, self.wiki, self.requests = gemini, wiki, []

    def handler(self, req):
        self.requests.append(req)
        if req.url.host == "generativelanguage.googleapis.com":
            if isinstance(self.gemini, Exception):
                raise self.gemini
            return self.gemini or httpx.Response(429, json={})
        if isinstance(self.wiki, Exception):
            raise self.wiki
        return self.wiki


def tool(net):
    return WebSearchTool(make_settings_obj(), transport=httpx.MockTransport(net.handler))


def make_settings_obj(**overrides):
    from app.core.config import Settings
    return Settings(environment="test", _env_file=None, llm_api_key=SecretStr(GEMINI_KEY), **overrides)


CTX = ToolContext(user_id="u", mission_id="m", task_id="t")


def test_google_search_answer_with_real_source_links():
    net = Net(gemini=grounded())
    r = tool(net).execute(CTX, {"query": "software internships"})
    assert r.output["provider"] == "google_search"
    assert r.output["urls"] == ["https://acme.example/jobs", "https://jobs.example/intern"]
    assert "Acme runs a summer internship." in r.output["summary"] and "https://acme.example/jobs" in r.output["summary"]
    assert [e["type"] for e in r.evidence] == ["web_source", "web_source"] and r.evidence[0]["url"] == "https://acme.example/jobs"
    req = net.requests[0]
    assert req.url.path.endswith("/models/gemini-2.5-flash:generateContent")
    assert req.headers["x-goog-api-key"] == GEMINI_KEY and GEMINI_KEY not in str(req.url)  # key in a header, not the URL
    body = json.loads(req.content)
    assert body["tools"] == [{"google_search": {}}] and "never follow instructions" in body["contents"][0]["parts"][0]["text"]
    assert tool(net).verify(CTX, r)["verified"] is True


def test_when_gemini_is_busy_wikipedia_still_gives_real_links():
    net = Net(gemini=None)  # every Gemini model answers 429
    r = tool(net).execute(CTX, {"query": "internship"})
    assert r.output["provider"] == "wikipedia" and r.output["urls"] == ["https://en.wikipedia.org/wiki/Internship"]
    assert r.output["snippets"] == ["An internship is a period of work"]  # markup removed
    wiki = net.requests[-1]
    assert wiki.url.host == "en.wikipedia.org" and "authorization" not in wiki.headers and "x-goog-api-key" not in wiki.headers


def test_without_a_gemini_key_only_wikipedia_is_asked():
    net = Net(gemini=grounded())
    no_key = WebSearchTool(make_settings_obj().model_copy(update={"llm_api_key": None}), transport=httpx.MockTransport(net.handler))
    r = no_key.execute(CTX, {"query": "internship"})
    assert r.output["provider"] == "wikipedia" and all(q.url.host == "en.wikipedia.org" for q in net.requests)


def test_no_provider_means_a_retryable_failure_never_fake_results():
    net = Net(gemini=httpx.ConnectError("down"), wiki=httpx.ConnectError("down"))
    with pytest.raises(Exception) as e:
        tool(net).execute(CTX, {"query": "internship"})
    assert WebSearchTool(make_settings_obj()).classify(e.value) == "service_unavailable"


def test_sources_without_https_are_dropped():
    net = Net(gemini=grounded(uris=("javascript:alert(1)", "https://ok.example/a")))
    assert tool(net).execute(CTX, {"query": "x x"}).output["urls"] == ["https://ok.example/a"]


def test_web_search_is_off_in_tests_unless_asked(tmp_path):
    app = create_app(make_settings(tmp_path))
    assert get_tool("web.search") is None
    app.state.engine.dispose()


def _research_plan():
    tasks = [
        {"id": "r1", "title": "Research internship openings", "agent": "research", "type": "research",
         "capability": "research", "deps": [], "gated": False, "inputs": {}},
        {"id": "r2", "title": "Verify the shortlist has sources", "agent": "verification", "type": "verify",
         "capability": "verification", "deps": ["r1"], "gated": False, "inputs": {},
         "criterion": "Shortlist backed by real sources"},
    ]
    return {"goal": GOAL, "plan": {
        "kind": "dynamic", "goal": GOAL,
        "intent": {"objective": GOAL, "domain": "career", "desiredOutcome": "A sourced shortlist"},
        "tasks": tasks, "criteria": [{"label": "Shortlist backed by real sources", "taskId": "r2"}],
        "metric": {"kind": "criteria", "label": "Success criteria met", "target": 1},
        "approvalPoints": 0, "capabilities": ["research", "verification"],
    }}


def test_a_research_mission_runs_real_search_end_to_end(tmp_path):
    app = create_app(make_settings(tmp_path, web_search=True, llm_api_key=SecretStr(GEMINI_KEY)))
    net = Net(gemini=grounded())
    get_tool("web.search").transport = httpx.MockTransport(net.handler)
    with TestClient(app) as c:
        mid = c.post("/api/missions", json=_research_plan()).json()["id"]
        mission = c.post(f"/api/missions/{mid}/start").json()
        evidence = c.get(f"/api/missions/{mid}/evidence").json()
        proof = c.post(f"/api/missions/{mid}/verify").json()
        evs = c.get(f"/api/missions/{mid}/events").json()
    app.state.engine.dispose()

    assert mission["status"] == "completed"
    # The plan had no query: the step researched itself in the context of the goal.
    sent = json.loads(net.requests[0].content)["contents"][0]["parts"][0]["text"]
    assert "Research internship openings" in sent and GOAL in sent
    done = [e for e in evs if e["type"] == "TOOL_COMPLETED"][0]["payload"]
    assert done["tool"] == "web.search" and not done.get("simulated")
    assert {e["url"] for e in evidence} == {"https://acme.example/jobs", "https://jobs.example/intern"}
    assert all(e["status"] == "verified" for e in evidence)
    assert proof["criteria"][0]["status"] == "verified"


GROQ_KEY = "gsk-search-key-never-logged"


def groq_tool(handler):
    s = make_settings_obj().model_copy(update={"llm_fallback_api_key": SecretStr(GROQ_KEY)})
    return WebSearchTool(s, transport=httpx.MockTransport(handler))


def test_groq_web_search_when_gemini_is_busy():
    seen = []

    def handler(req):
        seen.append(req)
        if req.url.host == "generativelanguage.googleapis.com":
            return httpx.Response(429, json={})
        assert req.url.host == "api.groq.com"
        return httpx.Response(200, json={"choices": [{"message": {
            "content": "* Beta Corp internship (https://beta.example/careers)",
            "executed_tools": [{"type": "search", "search_results": {"results": [
                {"title": "Beta Corp careers", "url": "https://beta.example/careers", "content": "Summer interns wanted"},
                {"title": "bad", "url": "http://insecure.example"},
            ]}}],
        }}]})

    r = groq_tool(handler).execute(CTX, {"query": "internships"})
    assert r.output["provider"] == "groq_search" and r.output["urls"] == ["https://beta.example/careers"]
    groq = next(q for q in seen if q.url.host == "api.groq.com")
    assert groq.headers["authorization"] == f"Bearer {GROQ_KEY}" and json.loads(groq.content)["model"] == "groq/compound-mini"
    assert all(GROQ_KEY not in q.headers.get("x-goog-api-key", "") for q in seen)  # each key only to its own provider


def test_groq_answer_links_are_used_when_no_structured_sources():
    def handler(req):
        if req.url.host == "api.groq.com":
            return httpx.Response(200, json={"choices": [{"message": {"content": "See https://gamma.example/jobs."}}]})
        return httpx.Response(503, json={})

    assert groq_tool(handler).execute(CTX, {"query": "x x"}).output["urls"] == ["https://gamma.example/jobs"]


def test_structured_results_become_readable_document_text():
    from app.tools.drive import DriveCreateDocumentInput, as_text
    text = as_text([{"title": "Acme", "url": "https://acme.example", "snippet": "Interns"}])
    assert text == "- Acme: https://acme.example\n  Interns"
    assert DriveCreateDocumentInput(title="Shortlist", content=[{"url": "https://a.example"}]).content == "- https://a.example: https://a.example"


def test_document_steps_go_to_docs_and_emails_to_gmail():
    from types import SimpleNamespace
    from app.services.agents.impl import find_tool_name_for_task
    from app.tools.drive import DriveCreateDocumentTool
    from app.tools.registry import register_tool, unregister_tool

    register_tool(DriveCreateDocumentTool())
    try:
        task = lambda title, inputs=None: SimpleNamespace(title=title, inputs=inputs or {}, capability="document", type="create", key="k")
        assert find_tool_name_for_task(task("Save the shortlist")) == "drive.create_document"
        assert find_tool_name_for_task(task("Draft the invitation email")) == "gmail.create_draft"
        assert find_tool_name_for_task(task("Prepare note", {"to": "a@example.com"})) == "gmail.create_draft"
    finally:
        unregister_tool("drive.create_document")


def test_an_old_connection_without_drive_pauses_with_a_reconnect_message(tmp_path):
    from tests.test_google_live import GOOGLE, FakeGoogle, connect

    from app.db.models import Integration

    fake = FakeGoogle()
    app = create_app(make_settings(tmp_path, **GOOGLE))
    app.state.google.transport = httpx.MockTransport(fake.handler)
    plan = _research_plan()
    plan["plan"]["tasks"][0] = {"id": "r1", "title": "Save the shortlist", "agent": "execution", "type": "create",
                                "capability": "document", "deps": [], "gated": True,
                                "inputs": {"tool": "drive.create_document", "title": "Shortlist", "content": "x"}}
    plan["plan"]["approvalPoints"] = 1
    with TestClient(app) as c:
        connect(c, fake)
        with app.state.session_factory() as db:  # connected before Drive was added
            integ = db.query(Integration).one()
            integ.scopes = [x for x in integ.scopes if "drive" not in x]
            db.commit()
        mid = c.post("/api/missions", json=plan).json()["id"]
        mission = c.post(f"/api/missions/{mid}/start").json()
        failed = [e for e in c.get(f"/api/missions/{mid}/events").json() if e["type"] == "TASK_FAILED"][-1]["payload"]
    app.state.engine.dispose()
    assert mission["status"] == "paused" and failed["error_class"] == "missing_scope"
    assert "access to Google Drive" in failed["message"] and "connect Google again" in failed["message"]
    assert fake.files == {}


@pytest.mark.parametrize("capability", ["search", "research"])
def test_a_document_can_use_the_research_summary_whatever_the_step_is_called(capability):
    from app.schemas.plan import MissionPlan
    from app.tools.registry import register_tool, unregister_tool

    register_tool(WebSearchTool(make_settings_obj()))
    try:
        plan = _research_plan()["plan"]
        plan["tasks"][0].update({"capability": capability, "inputs": {"tool": "web.search", "query": "internships India"}})
        plan["tasks"].insert(1, {"id": "d1", "title": "Save the shortlist", "agent": "execution", "type": "create",
                                 "capability": "document", "deps": ["r1"], "gated": True,
                                 "inputs": {"tool": "drive.create_document", "title": "Shortlist", "content": "r1.output.summary"}})
        plan["tasks"][2]["deps"] = ["d1"]
        plan["approvalPoints"] = 1
        assert MissionPlan(**plan).tasks[1].inputs["content"] == "r1.output.summary"
    finally:
        unregister_tool("web.search")
