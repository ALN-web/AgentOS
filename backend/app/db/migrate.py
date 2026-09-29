"""Run Alembic migrations from code (used at startup in development/test and by tests)."""

from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def alembic_config(database_url: str) -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    cfg.attributes["database_url"] = database_url
    return cfg


def upgrade_to_head(database_url: str) -> None:
    command.upgrade(alembic_config(database_url), "head")
