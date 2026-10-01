"""Accounts, sessions and per-user isolation (#32)."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.db.models import User, UserSession
from app.main import create_app
from app.services.auth import SESSION_COOKIE
from tests.conftest import make_settings
from tests.test_cross_app import _make_cross_app_plan

PASSWORD = "correct horse battery"


@pytest.fixture
def app(tmp_path):
    # Real sign-in rules: no local-user fallback.
    app = create_app(make_settings(tmp_path, auth_local_fallback=False))
    yield app
    app.state.engine.dispose()


def client(app):
    return TestClient(app, raise_server_exceptions=False)


def signup(c, email="ana@example.com", password=PASSWORD, name="Ana"):
    return c.post("/api/auth/signup", json={"email": email, "password": password, "name": name})


def test_signup_signs_in_and_never_returns_or_stores_the_password(app):
    c = client(app)
    res = signup(c, email="  Ana@Example.com ")
    assert res.status_code == 201
    u = res.json()["user"]
    assert (u["email"], u["name"], set(u)) == ("ana@example.com", "Ana", {"id", "email", "name", "created_at"})
    assert PASSWORD not in res.text
    assert c.get("/api/auth/me").json()["user"]["email"] == "ana@example.com"
    with app.state.session_factory() as db:
        user = db.query(User).filter_by(email="ana@example.com").one()
        assert user.password_hash.startswith("scrypt$") and PASSWORD not in user.password_hash
        token = c.cookies.get(SESSION_COOKIE)
        assert token and db.query(UserSession).filter_by(token_hash=token).count() == 0  # only the hash is stored


def test_session_cookie_is_httponly_lax_and_host_only(app):
    cookie = signup(client(app)).headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "path=/" in cookie
    assert "domain=" not in cookie  # so the OAuth callback on the backend port also sees it


def test_duplicate_email_is_refused_case_insensitively(app):
    signup(client(app))
    res = signup(client(app), email="ANA@example.com")
    assert res.status_code == 409 and res.json()["error"]["code"] == "email_taken"


@pytest.mark.parametrize("email, password, code", [
    ("not-an-email", PASSWORD, "invalid_email"),
    ("ana@example.com", "short", "weak_password"),
    ("ana@example.com", "x" * 129, "weak_password"),
])
def test_signup_validation(app, email, password, code):
    res = signup(client(app), email=email, password=password)
    assert res.status_code == 422 and res.json()["error"]["code"] == code


def test_login_with_the_right_password_only(app):
    signup(client(app))
    c = client(app)
    ok = c.post("/api/auth/login", json={"email": "ana@example.com", "password": PASSWORD})
    assert ok.status_code == 200 and ok.json()["user"]["email"] == "ana@example.com"
    for body in ({"email": "ana@example.com", "password": "wrong password"}, {"email": "nobody@example.com", "password": PASSWORD}):
        bad = client(app).post("/api/auth/login", json=body)
        assert bad.status_code == 401
        assert bad.json()["error"] == {**bad.json()["error"], "code": "invalid_credentials", "message": "Wrong email or password."}


def test_logout_ends_the_session_for_good(app):
    c = client(app)
    signup(c)
    token = c.cookies.get(SESSION_COOKIE)
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").status_code == 401
    replay = client(app)
    replay.cookies.set(SESSION_COOKIE, token)
    assert replay.get("/api/missions").status_code == 401


def test_an_expired_session_is_refused(app):
    c = client(app)
    signup(c)
    with app.state.session_factory() as db:
        s = db.query(UserSession).one()
        s.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert c.get("/api/auth/me").status_code == 401


def test_protected_apis_need_a_session(app):
    c = client(app)
    for method, path in [("GET", "/api/missions"), ("GET", "/api/preferences"), ("GET", "/api/integrations"),
                         ("POST", "/api/integrations/google/connect"), ("GET", "/api/apps")]:
        res = c.request(method, path)
        assert res.status_code == 401, path
        assert res.json()["error"]["code"] == "not_authenticated"


def test_missions_are_isolated_per_user(app):
    a, b = client(app), client(app)
    signup(a, email="a@example.com")
    signup(b, email="b@example.com")
    mid = a.post("/api/missions", json=_make_cross_app_plan()).json()["id"]
    a.post(f"/api/missions/{mid}/start")
    approval = [e for e in a.get(f"/api/missions/{mid}/events").json() if e["type"] == "APPROVAL_REQUESTED"][0]["payload"]["approval_id"]

    assert b.get("/api/missions").json() == []
    for method, path in [("GET", f"/api/missions/{mid}"), ("GET", f"/api/missions/{mid}/events"),
                         ("GET", f"/api/missions/{mid}/evidence"), ("GET", f"/api/missions/{mid}/proof"),
                         ("POST", f"/api/missions/{mid}/verify"), ("POST", f"/api/missions/{mid}/start"),
                         ("POST", f"/api/missions/{mid}/cancel"), ("GET", f"/api/approvals/{approval}")]:
        assert b.request(method, path).status_code == 404, path
    assert b.post(f"/api/approvals/{approval}/decision", json={"decision": "approve"}).status_code == 404
    assert b.get(f"/api/missions/{mid}/stream").status_code in (401, 404)
    # A still owns it, untouched by B.
    assert a.get(f"/api/missions/{mid}").json()["status"] == "awaiting_approval"


def test_repeated_failed_logins_are_rate_limited(app):
    signup(client(app))
    c = client(app)
    codes = [c.post("/api/auth/login", json={"email": "ana@example.com", "password": "nope nope"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_production_never_falls_back_to_a_local_user(tmp_path):
    prod = create_app(make_settings(tmp_path, environment="production", auth_local_fallback=True))
    with TestClient(prod) as c:
        assert c.get("/api/missions").status_code == 401
    prod.state.engine.dispose()


def test_auth_is_also_served_under_v1_with_created_at(app):
    c = client(app)
    res = c.post("/api/v1/auth/signup", json={"email": "v1@example.com", "password": PASSWORD})
    assert res.status_code == 201 and res.json()["user"]["created_at"]
    assert c.get("/api/v1/auth/me").json()["user"]["email"] == "v1@example.com"


def test_writes_from_another_website_are_refused(app):
    c = client(app)
    signup(c)
    evil = c.post("/api/missions", json={}, headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403 and evil.json()["error"]["code"] == "bad_origin"
    ours = c.post("/api/auth/logout", headers={"Origin": "http://localhost:3000"})
    assert ours.status_code == 200
    assert c.get("/api/health", headers={"Origin": "https://evil.example"}).status_code == 200  # reads are fine
