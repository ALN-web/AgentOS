# AgentOS Live Mode: assessment and design

Status: **Phase 0 (protect Demo Mode) and Phase 1 (backend foundation) are done.** Everything else below is design, not implemented. Live Mode is not exposed in the UI, and `/api/health` reports `live_mode.available: false`.

## 1. What already exists and maps onto the target

| Target layer | Today (Demo Mode, browser) | Reuse in Live Mode |
|---|---|---|
| Mission Intent | `src/agentos/intent.js` (deterministic) | Keep for Demo. Port the **shape** to a Pydantic `MissionIntent`; the LLM planner fills it. |
| Dynamic Planner | `src/agentos/planner.js` → `MissionPlan` (plain data) | **The key contract.** The backend returns plans in the same shape, so every UI panel works unchanged. |
| Capability Registry | `src/agentos/capabilities.js` (capability → agent, external flag, failures, alternatives) | Mirrors to backend `capabilities`. Tools register *against* capability ids. |
| Execution engine | `src/engine/engine.js` + `compile.js`: timer-driven script of `ops` | Demo only. In Live Mode the backend runtime executes, and the frontend applies **server events** through the same `ops` functions (`say`, `task`, `recovery`, `check`, approvals). No second UI engine. |
| Approvals | `resolveApproval` (approve / edit / reject, edits flow downstream) | Same UX; the decision becomes `POST /api/approvals/{id}/decision`, and the server is authoritative. |
| Recovery | `agentos/recovery.js` failure classes + `replaceTask` | Same concepts on the server, with real failure classes, retry limits and budgets. |
| Verification | criteria in the plan + `check` op | Server verifies against **evidence**, not agent claims. |
| Explainability | `selectors.explainEvent / explainTask` | Adds an Evidence section fed by stored evidence. |
| Persistence | localStorage (validated, versioned) | Demo only. Live missions live in the database. |
| UI | Mission Control, timeline, task graph, workforce, approvals, outcome, replay | Reused as-is; Live Mode adds a mission source, Connected Apps settings and a mode indicator. |

**Backend boundary:** the frontend never executes real actions, never holds credentials and never calls third-party APIs. It talks only to the AgentOS API (REST plus an SSE event stream). Everything real happens behind the Tool Registry and the Policy Engine.

## 2. Folder structure

```
backend/
  app/
    main.py                 app factory, middleware, routers            [Phase 1 ✓]
    core/                   config (typed, SecretStr), logging, errors   [Phase 1 ✓]
    api/                    health ✓ · missions · approvals · events · integrations · tools
    db/                     engine/session, models, Alembic migrations   [Phase 2]
    schemas/                Pydantic: MissionIntent, MissionPlan, events, tool I/O
    planner/                base.py (Planner protocol) · deterministic.py · llm.py
    runtime/                mission runner, scheduler, budgets, event bus
    agents/                 capability-oriented: planner, research, browser, communication,
                            document, monitoring, verification, recovery
    tools/                  base.py (Tool) · registry.py · google/{gmail,calendar,drive,forms}.py
                            · web/{search,browser}.py
    policy/                 risk levels, rules, approval gateway
    integrations/           OAuth flows, encrypted token store, credential provider
    verification/ evidence/ recovery/
  tests/
src/live/                   (frontend) API client, SSE subscription, live mission source
docs/live-mode.md           this document
```

## 3. Database schema (SQLAlchemy; SQLite locally, PostgreSQL in production)

- **user**: id, email, created_at
- **integration**: id, user_id, provider (`google`), scopes[], status, encrypted_token (bytes), token_expires_at, created_at. Tokens are encrypted with `AGENTOS_ENCRYPTION_KEY` and never serialised to API responses.
- **mission**: id, user_id, goal, mode (`live`), status, plan_json (the MissionPlan), metric_current, metric_target, budget_json, created_at, started_at, completed_at
- **mission_intent**: mission_id (PK/FK), objective, domain, desired_outcome, intent_json
- **task**: id, mission_id, key, title, type, capability, agent, status, gated, criterion, started_at, finished_at, replaced_by
- **task_dependency**: task_id, depends_on_task_id
- **agent_execution**: id, mission_id, task_id, agent, started_at, finished_at, status
- **tool_execution**: id, mission_id, task_id, tool, risk, input_json (redacted), output_json, status, error_class, attempt, started_at, finished_at
- **approval**: id, mission_id, task_id, tool, risk, category, reason, payload_json, original_payload_json, status (`pending/approved/edited/rejected`), requested_at, decided_at, decided_by
- **evidence**: id, mission_id, task_id, tool_execution_id, type, source, reference_id, label, url, created_at
- **mission_event**: id, mission_id, seq (monotonic per mission), type, agent, payload_json, created_at. This is the event log the UI replays; `seq` lets clients resume after a disconnect.
- **recovery_attempt**: id, mission_id, task_id, failure_class, diagnosis, strategy, status, attempt, created_at

## 4. API contracts (all under `/api`, JSON; errors as `{"error": {code, message, request_id}}`)

| Method and path | Purpose |
|---|---|
| `GET /health` ✓ | liveness + `live_mode.available` |
| `POST /missions/analyze` `{goal, answers}` | `{intent, plan}`; nothing is executed |
| `POST /missions` `{goal, plan?, budget?}` | create a mission (status `planned`) |
| `GET /missions` · `GET /missions/{id}` | the user's missions only |
| `POST /missions/{id}/start` · `/pause` · `/resume` · `/cancel` | lifecycle |
| `GET /missions/{id}/events?after={seq}` | event backlog |
| `GET /missions/{id}/stream` | SSE: `MISSION_STARTED`, `TASK_STARTED`, `AGENT_ASSIGNED`, `TOOL_CALLED`, `TOOL_COMPLETED`, `APPROVAL_REQUESTED/GRANTED/REJECTED`, `TASK_FAILED`, `RECOVERY_STARTED`, `PLAN_UPDATED`, `VERIFICATION_STARTED/COMPLETED`, `MISSION_COMPLETED/FAILED` |
| `POST /approvals/{id}/decision` `{decision, edits?}` | approve / edit / reject; idempotent, refuses anything not pending |
| `GET /missions/{id}/evidence` | evidence records |
| `GET /tools` | the registry: name, capability, risk, and whether it is available for this user |
| `GET /integrations` · `GET /integrations/google/connect` · `GET /integrations/google/callback` · `DELETE /integrations/{id}` | connected apps; never returns tokens |

## 5. Tool Registry interface

```python
class RiskLevel(StrEnum): LOW, MEDIUM, HIGH, CRITICAL

class ToolContext:            # what a tool receives; never raw credentials
    user_id; mission_id; task_id
    allowed_scopes: frozenset[str]
    credentials: CredentialProvider      # opaque handle, resolves tokens server-side
    budget: BudgetTracker

class ToolResult:             # every execution returns this
    status: "success" | "failed"; tool: str; output: dict
    evidence: list[Evidence]; timestamp; verification: dict | None
    error_class: FailureClass | None

class Tool(ABC):
    name: str                 # "gmail.send_email"
    capability: str           # "communication"
    description: str
    input_model: type[BaseModel]
    risk: RiskLevel
    required_scopes: tuple[str, ...]
    integration: str | None   # "google"
    async def execute(self, ctx, args) -> ToolResult
    async def verify(self, ctx, result) -> Verification
    def classify(self, exc) -> FailureClass
```

Agents ask for a **capability** (`communication.send`). The registry picks an available tool. The Policy Engine decides whether it runs automatically, needs approval, or is forbidden, before `execute` is ever called.

Default risk: search LOW · read document MEDIUM · draft email MEDIUM · send email HIGH · create public calendar event HIGH · purchase HIGH · delete CRITICAL (forbidden by default).

## 6. Integrations and OAuth (Google Workspace first)

- Server-side OAuth 2.0 authorization-code flow with PKCE and a signed `state`. The browser only ever sees Google's consent screen and our redirect.
- Minimal scopes, requested per capability: `gmail.send`, `calendar.events`, `drive.file`, `forms.body`, `forms.responses.readonly`.
- Tokens are encrypted at rest (Fernet, key from `AGENTOS_ENCRYPTION_KEY`). They're decrypted only inside `CredentialProvider` during a tool call, and never logged, returned by the API, or placed in any LLM prompt.
- Needs from the project owner: a Google Cloud project, an OAuth client (web), and the redirect URI. Until Google verifies the app, only listed test users can connect (enough for a hackathon demo).

## 7. First real mission: College Hackathon Organizer (no hardcoded workflow)

Goal: *"Organize a hackathon for 100 students in my college."*

1. **Plan.** The planner (LLM, with the deterministic planner as fallback) produces a validated MissionPlan from the general capabilities. The existing event blueprint already yields: requirements → structure → registration form → announcement → promotion → approval → send → monitor → verify.
2. **Tool bindings.** These come from the registry, not the plan:
   - form → `forms.create_form` (MEDIUM)
   - date → `calendar.create_event` (HIGH, needs approval)
   - announcement → `gmail.send_email` (HIGH, needs approval; edits flow into the send)
   - monitoring → `forms.list_responses` (LOW), polled
   - research → `web.search` (LOW)
3. **Evidence.** Each step records its evidence: form id and URL, calendar event id, Gmail message ids, response counts.
4. **Verification.** Counts unique form responses against the target. A shortfall becomes a failure that triggers a bounded recovery: re-plan extra outreach, which needs approval again.
5. **Honesty.** Reaching 100 real registrations takes days. The live demo can verify the *setup* in real time (form exists, event exists, email delivered); registration counting continues in the background.

## 8. Roadmap (each phase ends with `npm test`, `npm run build` and backend tests passing)

0 ✓ protect Demo Mode · 1 ✓ backend foundation · 2 database + persistent mission state · 3 mission APIs (analyze/create/list/lifecycle) · 4 Tool Registry (with a fake tool for tests only) · 5 integration framework · 6 OAuth + encrypted credentials · 7 policy engine + approval gateway · 8 agent runtime (event log, budgets) · 9 LLM planner (schema-validated) · 10 real tool execution · 11 verification + evidence · 12 recovery + re-planning (bounded) · 13 SSE · 14 Live Mission Control (frontend live source, Connected Apps, mode indicator shown only when `live_mode.available`) · 15 security hardening (auth, per-user isolation, rate limits, prompt-injection handling) · 16 real hackathon mission · 17 general-purpose validation.

## 9. Prerequisites the code cannot provide

- An **LLM API key** (Phase 9), set in `backend/.env`.
- A **Google Cloud OAuth client** (Phase 6).
- **Hosting** for the backend and PostgreSQL before Live Mode can be public. The Vercel frontend stays Demo Mode until then.
