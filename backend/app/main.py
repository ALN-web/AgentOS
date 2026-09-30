"""FastAPI application factory.

Run locally (from backend/):  uvicorn app.main:create_app --factory --reload --port 8000
"""

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import apps, approvals, capabilities, health, integrations, missions, preferences, tools
from app.core.config import Settings, get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging, get_logger, request_id_var
from app.db.migrate import upgrade_to_head
from app.db.session import make_engine, make_session_factory
from app.integrations.google import GoogleConnector
from app.services.missions import ensure_reference_data
from app.tools.google import GOOGLE_TOOLS
from app.tools.registry import register_tool, unregister_tool

log = get_logger("http")

REQUEST_ID_HEADER = "X-Request-ID"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        app.state.engine.dispose()

    app = FastAPI(
        lifespan=lifespan,
        title="AgentOS API",
        version=__version__,
        # Interactive docs are useful locally but not exposed in production.
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", REQUEST_ID_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        # Accept a well-formed incoming id (for tracing), otherwise make one.
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        rid = incoming if 8 <= len(incoming) <= 64 and incoming.replace("-", "").isalnum() else uuid.uuid4().hex
        token = request_id_var.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[REQUEST_ID_HEADER] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    if settings.auto_migrate:
        upgrade_to_head(settings.database_url)
    app.state.session_factory = make_session_factory(app.state.engine)
    with app.state.session_factory() as db:
        ensure_reference_data(db)

    # Real Google tools exist only when OAuth and token encryption are configured (#6).
    app.state.google = GoogleConnector(settings)
    for tool in GOOGLE_TOOLS:
        is_sim = getattr(tool, "kind", "real") == "simulated"
        if is_sim:
            register_tool(tool)
        if app.state.google.configured and not is_sim:
            register_tool(tool)
            if hasattr(tool, "action_id") and tool.action_id:
                register_tool(tool.action_id)

    install_error_handlers(app)
    app.include_router(health.router, prefix="/api")
    app.include_router(missions.router, prefix="/api")
    app.include_router(missions.router, prefix="/api/v1")
    app.include_router(approvals.router, prefix="/api")
    app.include_router(capabilities.router, prefix="/api")
    app.include_router(apps.router, prefix="/api")
    app.include_router(apps.router, prefix="/api/v1")
    app.include_router(integrations.router, prefix="/api")
    app.include_router(integrations.router, prefix="/api/v1")
    app.include_router(preferences.router, prefix="/api")
    app.include_router(tools.router, prefix="/api/v1")
    app.include_router(tools.router, prefix="/api")
    log.info("AgentOS API %s started (%s)", __version__, settings.environment)
    return app

