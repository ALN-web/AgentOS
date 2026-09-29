from fastapi.testclient import TestClient
from pydantic import BaseModel, SecretStr

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app


def test_health_reports_status_and_that_live_mode_is_not_available(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "agentos-backend"
    assert body["environment"] == "test"
    assert body["live_mode"]["available"] is False
    assert body["live_mode"]["reason"]


def test_every_response_carries_a_request_id(client):
    res = client.get("/api/health")
    rid = res.headers["X-Request-ID"]
    assert len(rid) == 32
    assert res.headers["X-Content-Type-Options"] == "nosniff"


def test_a_well_formed_incoming_request_id_is_kept(client):
    res = client.get("/api/health", headers={"X-Request-ID": "trace-1234-abcd"})
    assert res.headers["X-Request-ID"] == "trace-1234-abcd"


def test_a_malformed_incoming_request_id_is_replaced(client):
    res = client.get("/api/health", headers={"X-Request-ID": "<script>alert(1)</script>"})
    assert res.headers["X-Request-ID"] != "<script>alert(1)</script>"


def test_unknown_routes_use_the_standard_error_shape(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    err = res.json()["error"]
    assert err["code"] == "not_found"
    assert err["request_id"] == res.headers["X-Request-ID"]


def test_app_errors_keep_their_code_and_status(app):
    @app.get("/api/_boom_app")
    def boom_app():
        raise AppError("mission_not_found", "No such mission.", status_code=404)

    res = TestClient(app).get("/api/_boom_app")
    assert res.status_code == 404
    assert res.json()["error"] == {
        "code": "mission_not_found",
        "message": "No such mission.",
        "request_id": res.headers["X-Request-ID"],
    }


def test_validation_errors_list_the_fields(app):
    class Body(BaseModel):
        goal: str

    @app.post("/api/_echo")
    def echo(body: Body):
        return body

    res = TestClient(app).post("/api/_echo", json={})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "validation_error"
    assert err["fields"][0]["loc"][-1] == "goal"


def test_unexpected_errors_never_leak_details(app):
    @app.get("/api/_boom")
    def boom():
        raise RuntimeError("database password is hunter2")

    res = TestClient(app, raise_server_exceptions=False).get("/api/_boom")
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "internal_error"
    assert "hunter2" not in res.text
    assert "RuntimeError" not in res.text


def test_cors_allows_only_configured_origins(client):
    ok = client.options(
        "/api/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"}
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options(
        "/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"}
    )
    assert "access-control-allow-origin" not in bad.headers


def test_secrets_never_appear_in_settings_output():
    s = Settings(environment="test", encryption_key=SecretStr("super-secret-key"), _env_file=None)
    assert "super-secret-key" not in repr(s)
    assert "super-secret-key" not in str(s.model_dump())
    assert s.encryption_key.get_secret_value() == "super-secret-key"


def test_settings_read_prefixed_environment_variables(monkeypatch):
    monkeypatch.setenv("AGENTOS_ENVIRONMENT", "production")
    monkeypatch.setenv("AGENTOS_CORS_ORIGINS", '["https://agentos.example"]')
    s = Settings(_env_file=None)
    assert s.is_production
    assert s.cors_origins == ["https://agentos.example"]


def test_api_docs_are_hidden_in_production():
    prod = TestClient(create_app(Settings(environment="production", _env_file=None)))
    assert prod.get("/api/docs").status_code == 404
    assert prod.get("/api/openapi.json").status_code == 404
    dev = TestClient(create_app(Settings(environment="development", _env_file=None)))
    assert dev.get("/api/openapi.json").status_code == 200
