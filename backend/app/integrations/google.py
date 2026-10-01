"""Google OAuth, encrypted token storage and a minimal Calendar/Gmail client (#6).

Rules:
- Server-side authorisation-code flow with PKCE (S256). The `state` is a Fernet
  token (encrypted, authenticated, expires in 10 minutes) carrying the user id and
  the PKCE verifier, so it cannot be forged, replayed later or read by the browser.
- Tokens are encrypted at rest with AGENTOS_ENCRYPTION_KEY and refreshed when they
  are about to expire. They never appear in API responses, logs, events or errors.
- Tools receive a `GoogleClient`, never a token: the client keeps it private.
- Google failures are mapped to the runtime's failure classes (GoogleError.error_class).
"""

import base64
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any
from urllib.parse import quote, urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import Integration, User

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
GMAIL_API = "https://gmail.googleapis.com/gmail/v1"
DRIVE_API = "https://www.googleapis.com/drive/v3"
FORMS_API = "https://forms.googleapis.com/v1/forms"

SCOPES = (
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/forms.body",
)

APP_SCOPES: dict[str, tuple[str, ...]] = {
    "google-calendar": ("https://www.googleapis.com/auth/calendar.events",),
    "calendar": ("https://www.googleapis.com/auth/calendar.events",),
    "gmail": ("https://www.googleapis.com/auth/gmail.compose",),
    "google-drive": ("https://www.googleapis.com/auth/drive.file",),
    "drive": ("https://www.googleapis.com/auth/drive.file",),
    "google-forms": (
        "https://www.googleapis.com/auth/forms.body",
    ),
    "forms": (
        "https://www.googleapis.com/auth/forms.body",
    ),
}
STATE_TTL_SECONDS = 600
REFRESH_MARGIN = timedelta(seconds=60)
TIMEOUT = httpx.Timeout(15.0, connect=5.0)
RECONNECT = "Reconnect Google in Apps and try again."


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GoogleError(Exception):
    """A classified Google failure. The message is safe to show and store."""

    def __init__(self, error_class: str, message: str, status_code: int | None = None):
        super().__init__(message)
        self.error_class = error_class
        self.message = message
        self.status_code = status_code


def _classify_response(res: httpx.Response) -> GoogleError:
    code = res.status_code
    reason = ""
    try:
        err = res.json().get("error")
        if isinstance(err, dict):
            reason = " ".join(str(e.get("reason", "")) for e in err.get("errors", []) or [])
        elif isinstance(err, str):
            reason = err
    except ValueError:
        pass
    if code == 401 or reason == "invalid_grant":
        return GoogleError("authentication_failed", f"Google access expired or was revoked. {RECONNECT}", code)
    if code == 429 or "rateLimitExceeded" in reason or "userRateLimitExceeded" in reason:
        return GoogleError("rate_limited", "Google is rate limiting requests. Try again shortly.", code)
    if code == 403:
        return GoogleError("permission_denied", "Google refused this action for the connected account.", code)
    if code == 404:
        return GoogleError("not_found", "Google could not find that item.", code)
    if code == 409:
        return GoogleError("conflict", "That item already exists in Google.", code)
    if code in (400, 422):
        return GoogleError("validation_error", "Google rejected the request as invalid.", code)
    if code >= 500:
        return GoogleError("service_unavailable", "Google is temporarily unavailable.", code)
    return GoogleError("service_unavailable", f"Unexpected response from Google ({code}).", code)


def _send(http: httpx.Client, method: str, url: str, **kwargs) -> httpx.Response:
    try:
        return http.request(method, url, **kwargs)
    except httpx.TimeoutException:
        raise GoogleError("timeout", "Google did not respond in time.") from None
    except httpx.HTTPError:
        raise GoogleError("network_error", "Could not reach Google.") from None


class TokenVault:
    """Encrypts token bundles and OAuth state with the server's Fernet key."""

    def __init__(self, key: str):
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def seal(self, data: dict) -> bytes:
        return self._fernet.encrypt(json.dumps(data).encode())

    def open(self, blob: bytes, ttl: int | None = None) -> dict:
        return json.loads(self._fernet.decrypt(blob, ttl=ttl))


class GoogleConnector:
    """Everything that needs the OAuth client and the encryption key."""

    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None):
        self.settings = settings
        self.transport = transport  # tests inject httpx.MockTransport here
        self.problem: str | None = None
        self.vault: TokenVault | None = None
        self._used_nonces: set[str] = set()
        if not settings.google_client_id or not settings.google_client_secret:
            self.problem = "Google is not configured on this server (AGENTOS_GOOGLE_CLIENT_ID / _SECRET)."
        elif not settings.encryption_key:
            self.problem = "AGENTOS_ENCRYPTION_KEY is not set, so tokens could not be stored safely."
        else:
            try:
                self.vault = TokenVault(settings.encryption_key.get_secret_value())
            except (ValueError, TypeError):
                self.problem = "AGENTOS_ENCRYPTION_KEY is not a valid Fernet key."

    @property
    def configured(self) -> bool:
        return self.vault is not None

    def http(self) -> httpx.Client:
        return httpx.Client(transport=self.transport, timeout=TIMEOUT)

    # ------------------------------------------------------------ OAuth

    def authorization_url(self, user: User, apps: list[str] | None = None) -> str:
        self._require()
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        nonce = secrets.token_hex(16)
        if apps:
            req_scopes_set = set()
            for app_name in apps:
                for sc in APP_SCOPES.get(app_name, ()):
                    req_scopes_set.add(sc)
            req_scopes = sorted(req_scopes_set) if req_scopes_set else list(SCOPES)
        else:
            req_scopes = list(SCOPES)
        state = self.vault.seal({"u": user.id, "v": verifier, "n": nonce, "s": req_scopes}).decode()
        params = {
            "client_id": self.settings.google_client_id,
            "redirect_uri": self.settings.google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(req_scopes),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params, quote_via=quote)}"

    def complete(self, db: Session, user: User, code: str, state: str) -> Integration:
        """Exchange the code, check the scopes, store the tokens encrypted."""
        self._require()
        try:
            st = self.vault.open(state.encode(), ttl=STATE_TTL_SECONDS)
        except (InvalidToken, ValueError):
            raise GoogleError("invalid_state", "The sign-in link expired or was tampered with. Try connecting again.") from None
        if st.get("u") != user.id:
            raise GoogleError("invalid_state", "This sign-in was started by a different user.")
        nonce = st.get("n")
        if nonce and nonce in self._used_nonces:
            raise GoogleError("invalid_state", "This sign-in link has already been used. Try connecting again.")
        if nonce:
            self._used_nonces.add(nonce)

        with self.http() as http:
            res = _send(http, "POST", TOKEN_URL, data={
                "code": code,
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret.get_secret_value(),
                "redirect_uri": self.settings.google_redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": st["v"],
            })
            if res.status_code != 200:
                raise _classify_response(res)
            tok = res.json()
            granted = set(str(tok.get("scope", "")).split())

            req_scopes = set(st.get("s") or SCOPES)
            missing = [s for s in req_scopes if s not in granted]
            if missing and req_scopes == set(SCOPES):
                raise GoogleError("missing_scopes", "Calendar and Gmail access are both needed. Tick both boxes when connecting.")
            elif missing and not (granted & req_scopes):
                raise GoogleError("missing_scopes", "Required permissions were not granted.")

            email = None
            try:
                userinfo = _send(http, "GET", "https://www.googleapis.com/oauth2/v2/userinfo", headers={"Authorization": f"Bearer {tok['access_token']}"})
                if userinfo.status_code == 200:
                    email = userinfo.json().get("email")
            except Exception:
                pass

            if not email:
                try:
                    profile = _send(http, "GET", f"{GMAIL_API}/users/me/profile", headers={"Authorization": f"Bearer {tok['access_token']}"})
                    if profile.status_code == 200:
                        email = profile.json().get("emailAddress")
                except Exception:
                    pass

        integ = db.scalar(select(Integration).where(Integration.user_id == user.id, Integration.provider == "google"))
        if integ is None:
            integ = Integration(user_id=user.id, provider="google")
            db.add(integ)
        old_scopes = set(integ.scopes or []) if integ.scopes else set()
        all_supported = set(s for scopes in APP_SCOPES.values() for s in scopes)
        integ.scopes = sorted((old_scopes | granted) & all_supported) if (old_scopes | granted) & all_supported else sorted(granted)
        integ.status = "connected"
        if email:
            integ.account_email = email
        elif not integ.account_email:
            integ.account_email = user.email
        old = self._tokens(integ) if integ.encrypted_token else {}
        self._store(integ, {
            "access_token": tok["access_token"],
            # Google only returns a refresh token on consent; keep the previous one otherwise.
            "refresh_token": tok.get("refresh_token") or old.get("refresh_token"),
        }, int(tok.get("expires_in", 3600)))
        db.commit()
        return integ

    def disconnect(self, db: Session, user: User) -> None:
        integ = self._integration(db, user)
        if integ is None:
            return
        if self.configured and integ.encrypted_token:
            try:
                token = self._tokens(integ).get("refresh_token") or self._tokens(integ).get("access_token")
                if token:
                    with self.http() as http:  # best effort; token in the body, never in a URL
                        _send(http, "POST", REVOKE_URL, data={"token": token})
            except Exception:
                pass
        integ.status = "disconnected"
        integ.encrypted_token = None
        integ.token_expires_at = None
        integ.scopes = []
        integ.account_email = None
        db.commit()

    # ------------------------------------------------------------ credentials

    def client_for(self, db: Session, user: User) -> "GoogleClient | None":
        """A client for this user's connected account, or None if not connected."""
        if not self.configured:
            return None
        integ = self._integration(db, user)
        if integ is None or integ.status != "connected" or not integ.encrypted_token:
            return None
        return GoogleClient(self, db, integ)

    def access_token(self, db: Session, integ: Integration) -> str:
        try:
            tokens = self._tokens(integ)
        except (InvalidToken, ValueError):
            self._expire(db, integ)
            raise GoogleError("authentication_failed", f"The stored Google token could not be read. {RECONNECT}") from None
        expires = integ.token_expires_at
        if expires is not None and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires is None or expires - REFRESH_MARGIN > utcnow():
            return tokens["access_token"]
        if not tokens.get("refresh_token"):
            self._expire(db, integ)
            raise GoogleError("authentication_failed", f"Google access expired. {RECONNECT}")
        with self.http() as http:
            res = _send(http, "POST", TOKEN_URL, data={
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret.get_secret_value(),
                "refresh_token": tokens["refresh_token"],
                "grant_type": "refresh_token",
            })
        if res.status_code != 200:
            err = _classify_response(res)
            err_data = {}
            try:
                err_data = res.json()
            except Exception:
                pass
            if err_data.get("error") == "invalid_grant" or "invalid_grant" in str(err_data) or res.status_code in (400, 401):
                integ.status = "needs_reconnect"
                integ.encrypted_token = None
                integ.token_expires_at = None
                db.commit()
                raise GoogleError("authentication_failed", f"Google access expired or was revoked. {RECONNECT}", res.status_code)
            raise err
        tok = res.json()
        self._store(integ, {"access_token": tok["access_token"], "refresh_token": tok.get("refresh_token") or tokens["refresh_token"]},
                    int(tok.get("expires_in", 3600)))
        db.flush()
        return tok["access_token"]

    # ------------------------------------------------------------ internals

    def _require(self) -> None:
        if not self.configured:
            raise GoogleError("not_configured", self.problem or "Google is not configured.")

    def _integration(self, db: Session, user: User) -> Integration | None:
        return db.scalar(select(Integration).where(Integration.user_id == user.id, Integration.provider == "google"))

    def _tokens(self, integ: Integration) -> dict:
        return self.vault.open(integ.encrypted_token)

    def _store(self, integ: Integration, tokens: dict, expires_in: int) -> None:
        integ.encrypted_token = self.vault.seal(tokens)
        integ.token_expires_at = utcnow() + timedelta(seconds=expires_in)

    def _expire(self, db: Session, integ: Integration) -> None:
        integ.status = "needs_reconnect"
        integ.encrypted_token = None
        integ.token_expires_at = None
        db.commit()


class GoogleClient:
    """Calendar and Gmail calls for one connected account. Holds no token itself:
    it asks the connector each time, which refreshes when needed."""

    def __init__(self, connector: GoogleConnector, db: Session, integ: Integration):
        self._connector = connector
        self._db = db
        self._integ = integ
        self.account_email = integ.account_email

    def _call(self, method: str, url: str, **kwargs) -> dict:
        token = self._connector.access_token(self._db, self._integ)
        with self._connector.http() as http:
            res = _send(http, method, url, headers={"Authorization": f"Bearer {token}"}, **kwargs)
        if res.status_code >= 400:
            err = _classify_response(res)
            if err.error_class == "authentication_failed":
                self._integ.status = "needs_reconnect"
                self._db.flush()
            raise err
        return res.json() if res.content else {}

    # Calendar
    def list_events(self, time_min: str, time_max: str, max_pages: int = 5) -> list[dict]:
        """Every event in the window (up to 5 x 250), so a busy calendar cannot hide a clash."""
        items: list[dict] = []
        page_token = None
        for _ in range(max_pages):
            params = {"timeMin": time_min, "timeMax": time_max, "singleEvents": "true", "orderBy": "startTime", "maxResults": 250}
            if page_token:
                params["pageToken"] = page_token
            data = self._call("GET", f"{CALENDAR_API}/calendars/primary/events", params=params)
            items.extend(data.get("items", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        return items

    def create_event(self, event: dict[str, Any]) -> dict:
        """Insert with a client-chosen id, so a retry can never create a duplicate."""
        try:
            return self._call("POST", f"{CALENDAR_API}/calendars/primary/events", params={"sendUpdates": "all"}, json=event)
        except GoogleError as err:
            if err.error_class == "conflict" and event.get("id"):
                return self.get_event(event["id"])
            raise

    def get_event(self, event_id: str) -> dict:
        return self._call("GET", f"{CALENDAR_API}/calendars/primary/events/{quote(event_id)}")

    def update_event(self, event_id: str, patch: dict[str, Any]) -> dict:
        return self._call("PATCH", f"{CALENDAR_API}/calendars/primary/events/{quote(event_id)}", params={"sendUpdates": "all"}, json=patch)

    # Gmail
    def create_draft(self, to: str, subject: str, body: str) -> dict:
        msg = EmailMessage()
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        return self._call("POST", f"{GMAIL_API}/users/me/drafts", json={"message": {"raw": raw}})

    def get_draft(self, draft_id: str) -> dict:
        return self._call("GET", f"{GMAIL_API}/users/me/drafts/{quote(draft_id)}", params={"format": "metadata"})

    def send_draft(self, draft_id: str) -> dict:
        return self._call("POST", f"{GMAIL_API}/users/me/drafts/send", json={"id": draft_id})

    def get_message(self, message_id: str) -> dict:
        return self._call("GET", f"{GMAIL_API}/users/me/messages/{quote(message_id)}")

    # Drive
    def search_drive(self, query: str) -> list[dict]:
        return self._call("GET", f"{DRIVE_API}/files", params={"q": query, "fields": "files(id,name,webViewLink,trashed,mimeType)"}).get("files", [])

    def create_document(self, metadata: dict[str, Any], content: str) -> dict:
        token = self._connector.access_token(self._db, self._integ)
        with self._connector.http() as http:
            res = _send(
                http, "POST", 
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,trashed",
                headers={"Authorization": f"Bearer {token}"},
                files={
                    "metadata": (None, json.dumps(metadata), "application/json"),
                    "file": (None, content, "text/plain")
                }
            )
        if res.status_code >= 400:
            raise _classify_response(res)
        return res.json()

    def get_file(self, file_id: str) -> dict:
        return self._call("GET", f"{DRIVE_API}/files/{quote(file_id)}", params={"fields": "id,name,webViewLink,mimeType,trashed"})

    def update_file_metadata(self, file_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        return self._call("PATCH", f"{DRIVE_API}/files/{quote(file_id)}", json=metadata)

    # ------------------------------------------------------------ Forms

    def create_form(self, form_data: dict[str, Any]) -> dict[str, Any]:
        return self._call("POST", FORMS_API, json=form_data)

    def update_form(self, form_id: str, update_data: dict[str, Any]) -> dict[str, Any]:
        return self._call("POST", f"{FORMS_API}/{quote(form_id)}:batchUpdate", json=update_data)

    def get_form(self, form_id: str) -> dict[str, Any]:
        return self._call("GET", f"{FORMS_API}/{quote(form_id)}")

def event_id_for(idempotency_key: str) -> str:
    """A valid Calendar event id (base32hex alphabet) derived from the idempotency key."""
    return "ag" + hashlib.sha256(idempotency_key.encode()).hexdigest()[:30]
