# AgentOS backend (Live Mode, in development)

The public AgentOS demo is the frontend Demo Mode and does **not** use this backend. This service is the foundation for Live Mode, which executes real actions through a tool registry, a policy engine and human approval. See [`../docs/live-mode.md`](../docs/live-mode.md) for the design and roadmap.

Current state: **Phase 2 plus part of Phase 3.**
- The app: FastAPI with typed settings, request ids, structured logging and a consistent error format.
- The database: SQLAlchemy models for the full Live Mode schema, with Alembic migrations (SQLite locally, PostgreSQL-ready).
- Capabilities: `GET /api/capabilities` returns the registry mirrored from the frontend, including calendar, email and reminders, with honest `simulated`/`live` modes. Plans must gate every external capability behind approval.
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
| `AGENTOS_ENCRYPTION_KEY` | none | Fernet key that encrypts stored Google tokens ; to rotate, set `new,old` (encrypts with the first, still opens the old) |
| `AGENTOS_PLANS_PER_HOUR` / `AGENTOS_MISSIONS_PER_HOUR` | `30` / `20` | per-user limits; over them the API answers 429 `rate_limited` |
| `AGENTOS_GOOGLE_CLIENT_ID` | none | Google OAuth client id (type **Web**) |
| `AGENTOS_GOOGLE_CLIENT_SECRET` | none | its secret |
| `AGENTOS_GOOGLE_REDIRECT_URI` | `http://localhost:8000/api/integrations/google/callback` | must match the OAuth client |
| `AGENTOS_FRONTEND_URL` | `http://localhost:3000` | where the OAuth callback returns the browser |
| `AGENTOS_LLM_API_KEY` | none | AI planner key for any OpenAI-compatible provider (Gemini by default). Without it, the deterministic planner is used |
| `AGENTOS_LLM_BASE_URL` | Gemini's OpenAI endpoint | e.g. `https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1`, `https://integrate.api.nvidia.com/v1` |
| `AGENTOS_LLM_MODEL` | `gemini-3.1-flash-lite` | the provider's model name (check the provider's model list) |
| `AGENTOS_LLM_FALLBACK_MODELS` | `gemini-2.5-flash,…` | more models at the same provider, tried when one is rate-limited or overloaded |
| `AGENTOS_LLM_FALLBACK_API_KEY` | none | optional second provider, tried after every primary model fails |
| `AGENTOS_LLM_FALLBACK_BASE_URL` | Groq's OpenAI endpoint | the second provider's endpoint |
| `AGENTOS_LLM_FALLBACK_PROVIDER_MODELS` | `llama-3.3-70b-versatile,…` | the second provider's models, in order |
| `AGENTOS_ANTHROPIC_API_KEY` | none | alternative AI planner via Anthropic, used when no `AGENTOS_LLM_API_KEY` is set |
| `AGENTOS_AUTH_LOCAL_FALLBACK` | unset | `true` lets a dev server act as one local user without signing in (never in production; tests use it by default) |

## Real Gmail and Google Calendar (#6)

Without the three Google/encryption settings, missions still run, but every Google
step is **simulated** and marked so (`simulated: true` in events, no proof links), and
`/api/health` reports `live_mode.available: false`. With them, Google steps are real.

1. In Google Cloud Console: create a project, enable the **Google Calendar API** and
   the **Gmail API**, configure the OAuth consent screen (External, Testing), and add
   the Google accounts you will demo with as **test users**.
2. Create an OAuth client ID of type **Web application** with the authorised redirect
   URI `http://localhost:8000/api/integrations/google/callback`.
3. Put the settings in `backend/.env` (git-ignored, never commit it):

   ```
   AGENTOS_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   AGENTOS_GOOGLE_CLIENT_SECRET=...
   AGENTOS_ENCRYPTION_KEY=<output of the command below>
   ```

   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

4. Restart the backend, open the app in Live Mode, go to **Apps** and connect Google.

How it behaves:
- Scopes are only `calendar.events` and `gmail.compose`. OAuth uses PKCE and an
  encrypted, expiring `state`. Tokens are encrypted at rest, refreshed when needed,
  revoked on disconnect, and never appear in responses, events or logs.
- Every tool call passes the policy engine (your per-app permissions). Creating an
  event and sending an email always wait for your approval; a draft runs on its own
  because nothing leaves your account. Rejecting a step skips it (and anything that
  needs it), and the mission still completes with that criterion left open.
- Failures are classified (`authentication_failed`, `permission_denied`, `rate_limited`,
  `service_unavailable`, `validation_error`, `timeout`, `network_error`); transient ones
  are retried at most twice. Budgets: 30 tool calls per mission, 120 s per run.
- Proof is re-read from Google: the event by its id, the draft by its id, and a sent
  email by Gmail's `SENT` label plus the draft having left Drafts. Calendar events use
  an id derived from the mission step, so a retry can never create a duplicate.

