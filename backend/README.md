# AgentOS backend (Live Mode, in development)

The public AgentOS demo is the frontend Demo Mode and does **not** use this backend. This service is the foundation for Live Mode, which executes real actions through a tool registry, a policy engine and human approval. See [`../docs/live-mode.md`](../docs/live-mode.md) for the design and roadmap.

Current state: **Phase 1, foundation only.**
- A FastAPI app with typed settings, request ids, structured logging and a consistent error format.
- `GET /api/health`, which reports `live_mode.available: false`.
- There is no database, tool or LLM yet.

## Run

Requires Python 3.11+.

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:8000/api/health. Interactive docs are at `/api/docs`; they are disabled in production.

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
| `AGENTOS_DATABASE_URL` | `sqlite:///./agentos.db` | used from Phase 2 |
| `AGENTOS_ENCRYPTION_KEY` | none | used from Phase 6 to encrypt integration tokens |
