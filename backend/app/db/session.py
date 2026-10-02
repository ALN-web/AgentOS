"""Database engine and sessions. SQLite for local development, PostgreSQL in production."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker


def make_engine(url: str) -> Engine:
    sqlite = url.startswith("sqlite")
    if sqlite:
        engine = create_engine(url, connect_args={"check_same_thread": False}, future=True)
    else:
        # Hosted Postgres (Neon) closes idle connections: check each one before use.
        engine = create_engine(url, future=True, pool_pre_ping=True, pool_recycle=300, pool_size=5, max_overflow=5,
                               pool_timeout=10, connect_args={"connect_timeout": 5})
    if sqlite:
        # SQLite ignores foreign keys unless asked, per connection.
        @event.listens_for(engine, "connect")
        def _fk(dbapi_connection, _):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, rolled back on error."""
    session = request.app.state.session_factory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
