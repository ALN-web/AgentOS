"""Typed settings, read from environment variables prefixed AGENTOS_ (or backend/.env).

Secrets are SecretStr, so they never appear in reprs, logs or error output.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Always backend/.env, whichever folder the server is started from.
    model_config = SettingsConfigDict(env_prefix="AGENTOS_", env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # Browser origins allowed to call the API (the Vite dev server and preview by default).
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://localhost:4173"])

    # SQLite for local development; PostgreSQL in production.
    database_url: str = "sqlite:///./agentos.db"
    # Apply migrations on startup. Convenient locally; production runs `alembic upgrade head` in deploy.
    auto_migrate: bool = True

    # Fernet key that encrypts stored integration tokens (#6). Never sent to clients.
    # Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: SecretStr | None = None

    # Google OAuth client (type "Web") for real Calendar and Gmail actions (#6).
    # Without it, Google steps run simulated and are marked as such.
    google_client_id: str | None = None
    google_client_secret: SecretStr | None = None
    google_redirect_uri: str = "http://localhost:8000/api/integrations/google/callback"
    # Where the OAuth callback sends the browser back to.
    frontend_url: str = "http://localhost:3000"

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.encryption_key)

    # AI planner (#45). Any OpenAI-compatible provider works (Gemini, Groq, OpenRouter,
    # NVIDIA NIM): set AGENTOS_LLM_API_KEY, and the base URL / model for non-Gemini ones.
    # Without a key, the deterministic planner is used.
    llm_api_key: SecretStr | None = None
    llm_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    llm_model: str = "gemini-2.5-flash"
    llm_timeout_seconds: float = 25.0  # x2 with one repair: stays under the 60 s the website waits

    # Alternatively Anthropic, used when AGENTOS_LLM_API_KEY is not set.
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-sonnet-5-5"
    anthropic_timeout_seconds: float = 45.0

    # Act as one local user when nobody is signed in (#32). Unset means: only in tests.
    # Never possible in production.
    auth_local_fallback: bool | None = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def allows_local_user(self) -> bool:
        if self.is_production:
            return False
        return self.environment == "test" if self.auth_local_fallback is None else self.auth_local_fallback


@lru_cache
def get_settings() -> Settings:
    return Settings()

