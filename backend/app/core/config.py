"""Typed settings, read from environment variables prefixed AGENTOS_ (or backend/.env).

Secrets are SecretStr, so they never appear in reprs, logs or error output.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AGENTOS_", env_file=".env", env_file_encoding="utf-8", extra="ignore")

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

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

