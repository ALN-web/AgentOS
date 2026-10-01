"""Production settings for the hosted deployment (Render + Neon + Vercel)."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.conftest import make_settings

SITE = "https://agentos-demo.vercel.app"


@pytest.mark.parametrize("given, expected", [
    ("postgres://u:p@ep-x.neon.tech/db?sslmode=require", "postgresql+psycopg://u:p@ep-x.neon.tech/db?sslmode=require"),
    ("postgresql://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
    ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
    ("sqlite:///./agentos.db", "sqlite:///./agentos.db"),
    ("psql 'postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require'",
     "postgresql+psycopg://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require"),
    ('  "postgresql://u:p@host/db"\n', "postgresql+psycopg://u:p@host/db"),
])
def test_hosted_postgres_urls_get_the_psycopg_driver(given, expected):
    assert Settings(_env_file=None, database_url=given).database_url == expected


@pytest.fixture
def prod(tmp_path):
    app = create_app(make_settings(tmp_path, environment="production", frontend_url=SITE))
    with TestClient(app, base_url="https://agentos-backend.onrender.com") as c:
        yield c
    app.state.engine.dispose()


def test_production_session_cookie_is_secure(prod):
    res = prod.post("/api/auth/signup", json={"email": "judge@example.com", "password": "a long password"}, headers={"Origin": SITE})
    assert res.status_code == 201
    cookie = res.headers["set-cookie"].lower()
    assert "secure" in cookie and "httponly" in cookie and "samesite=lax" in cookie


def test_production_trusts_only_the_real_site_for_writes(prod):
    body = {"email": "x@example.com", "password": "a long password"}
    assert prod.post("/api/auth/login", json=body, headers={"Origin": "https://evil.example"}).status_code == 403
    assert prod.post("/api/auth/login", json=body, headers={"Origin": SITE}).status_code == 401  # normal wrong-password answer


def test_production_hides_api_docs_and_requires_sign_in(prod):
    assert prod.get("/api/docs").status_code == 404
    assert prod.get("/api/missions").status_code == 401
    assert prod.get("/api/health").status_code == 200  # the keep-awake pinger needs no sign-in
