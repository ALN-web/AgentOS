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

    # Used from Phase 2 on. SQLite for local development; PostgreSQL in production.
    database_url: str = "sqlite:///./agentos.db"

    # Used from Phase 6 on to encrypt stored integration tokens. Never sent to clients.
    encryption_key: SecretStr | None = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

