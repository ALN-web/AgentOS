# AgentOS backend (Live Mode, in development)

The public AgentOS demo is the frontend Demo Mode and does **not** use this backend. This service is the foundation for Live Mode, which executes real actions through a tool registry, a policy engine and human approval. See [`../docs/live-mode.md`](../docs/live-mode.md) for the design and roadmap.

Current state: **Phase 2 plus part of Phase 3.**
- The app: FastAPI with typed settings, request ids, structured logging and a consistent error format.
- The database: SQLAlchemy models for the full Live Mode schema, with Alembic migrations (SQLite locally, PostgreSQL-ready).
- Missions: `POST/GET /api/missions`, `GET /api/missions/{id}` and `GET /api/missions/{id}/events`. They validate and store mission plans from the frontend planner.
- Health: `GET /api/health` reports database status and `live_mode.available: false`.
- Nothing executes yet: there are no tools, policy engine or LLM.
- Authentication does not exist yet either. In development every request acts as one local user; in production the mission endpoints refuse to serve (503) until authentication is added.

## Run

Requires Python 3.11+.

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:create_app --factory --reload --port 8000
```

Then open http://localhost:8000/api/health. Interactive docs are at `/api/docs`; they are disabled in production.

## Use with the frontend

With the backend running on port 8000, start the frontend with `npm run dev:live` from the repository root. It proxies `/api` to the backend, and the console sidebar shows the backend's status. Plain `npm run dev` is Demo Mode and never contacts the backend.

## Database

Migrations run automatically on startup unless `AGENTOS_AUTO_MIGRATE=false`. To run them by hand:

```bash
cd backend
alembic upgrade head
```

## Test

```bash
cd backend
python -m pytest
```

## Configuration

Environment variables, prefixed `AGENTOS_`, can also go in `backend/.env`. That file is git-ignored; never commit it.

| Variable | Default | Notes |
|---|---|---|
| `AGENTOS_ENVIRONMENT` | `development` | `development`, `test` or `production` (production hides API docs) |
| `AGENTOS_LOG_LEVEL` | `INFO` | |
| `AGENTOS_CORS_ORIGINS` | `["http://localhost:3000","http://localhost:4173"]` | JSON list |
| `AGENTOS_DATABASE_URL` | `sqlite:///./agentos.db` | e.g. `postgresql+psycopg://…` in production |
| `AGENTOS_AUTO_MIGRATE` | `true` | apply migrations at startup |
| `AGENTOS_ENCRYPTION_KEY` | none | used from Phase 6 to encrypt integration tokens |
