import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def make_settings(tmp_path, **overrides) -> Settings:
    """Settings with a throwaway SQLite database per test."""
    return Settings(
        environment=overrides.pop("environment", "test"),
        database_url=f"sqlite:///{(tmp_path / 'agentos-test.db').as_posix()}",
        _env_file=None,
        **overrides,
    )


@pytest.fixture
def settings(tmp_path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def app(settings):
    app = create_app(settings)
    yield app
    app.state.engine.dispose()


@pytest.fixture
def client(app):
    # Surface unexpected errors as responses, the way a real client sees them.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
