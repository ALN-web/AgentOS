"""Accounts and sessions (#32).

- Passwords are hashed with scrypt and a random salt; the plain password is never
  stored, logged or returned.
- A session is a random token in an httpOnly cookie. The database keeps only its
  SHA-256, so a leaked database cannot be replayed as a login.
- Failed sign-ins are rate limited per client and email.
"""

import base64
import hashlib
import hmac
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import User, UserSession

SESSION_COOKIE = "agentos_session"
SESSION_DAYS = 7
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MIN_PASSWORD, MAX_PASSWORD = 8, 128
# scrypt cost: about 50 ms per hash, memory ~16 MB.
_N, _R, _P, _DKLEN = 2**14, 8, 1, 32


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=_DKLEN)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str | None) -> bool:
    try:
        algo, n, r, p, salt, dk = (stored or "").split("$")
        if algo != "scrypt":
            return False
        expected = base64.b64decode(dk)
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected))
        return hmac.compare_digest(got, expected)
    except (ValueError, TypeError):
        return False


# Hash a throwaway password once, so a login for an unknown email costs the same time.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def normalise_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not EMAIL.match(email) or len(email) > 320:
        raise AppError("invalid_email", "Enter a valid email address.", status_code=422)
    return email


def check_password_rules(password: str) -> None:
    if not isinstance(password, str) or not MIN_PASSWORD <= len(password) <= MAX_PASSWORD:
        raise AppError("weak_password", f"Use a password of {MIN_PASSWORD} to {MAX_PASSWORD} characters.", status_code=422)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def signup(db: Session, email: str, password: str, name: str = "") -> User:
    email = normalise_email(email)
    check_password_rules(password)
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise AppError("email_taken", "An account with this email already exists. Sign in instead.", status_code=409)
    user = User(email=email, name=" ".join((name or "").split())[:80], password_hash=hash_password(password))
    db.add(user)
    db.commit()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    try:
        email = normalise_email(email)
    except AppError:
        email = ""
    user = db.scalar(select(User).where(User.email == email)) if email else None
    ok = verify_password(password or "", user.password_hash if user else _DUMMY_HASH)
    if user is None or not user.password_hash or not ok:
        raise AppError("invalid_credentials", "Wrong email or password.", status_code=401)
    return user


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    now = utcnow()
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at < now))
    db.add(UserSession(token_hash=_token_hash(token), user_id=user.id, expires_at=now + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def user_for_token(db: Session, token: str | None) -> User | None:
    if not token or len(token) > 200:
        return None
    s = db.get(UserSession, _token_hash(token))
    if s is None:
        return None
    expires = s.expires_at if s.expires_at.tzinfo else s.expires_at.replace(tzinfo=timezone.utc)
    if expires <= utcnow():
        db.delete(s)
        db.commit()
        return None
    return db.get(User, s.user_id)


def end_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _token_hash(token)))
        db.commit()


class AttemptLimiter:
    """At most `limit` failed attempts per key in `window` seconds (in memory, per process)."""

    def __init__(self, limit: int = 10, window: float = 300.0, code: str = "too_many_attempts",
                 message: str = "Too many attempts. Wait a few minutes and try again."):
        self.limit, self.window, self.code, self.message = limit, window, code, message
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> list[float]:
        hits = [t for t in self._hits.get(key, []) if now - t < self.window]
        self._hits[key] = hits
        return hits

    def check(self, key: str) -> None:
        with self._lock:
            if len(self._recent(key, time.monotonic())) >= self.limit:
                raise AppError(self.code, self.message, status_code=429)

    def fail(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._recent(key, now).append(now)

    def hit(self, key: str) -> None:
        """Count one use, refusing it (429) once the limit is reached."""
        with self._lock:
            now = time.monotonic()
            hits = self._recent(key, now)
            if len(hits) >= self.limit:
                raise AppError(self.code, self.message, status_code=429)
            hits.append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)
