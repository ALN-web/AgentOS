# AgentOS — Autonomous AI Workforce

**Give it a goal. AgentOS plans it, does the real work in your Google apps, asks before anything risky, and proves the result.**

> *"Don't tell AI what to do. Tell it what you want done."*

**Live site: https://agent-os-two-iota.vercel.app**: sign up, connect your Google account and run real missions.

AgentOS turns an everyday goal into a mission:

- an **AI planner** writes a plan of tasks;
- **agents** carry the plan out with **real tools**: Google Calendar, Gmail, Google Docs, Google Forms and web search;
- **you approve** every action that other people will see;
- **verification** re-reads the results from Google before AgentOS calls the mission done.

---

## Try it in 2 minutes (for judges)

1. Open **https://agent-os-two-iota.vercel.app** and click **Get started — connect your Google**.
   - The backend runs on a free server. The very first load can take up to a minute; the page says so and retries by itself.
2. **Sign up** with any email and a password of 8 characters or more.
3. Click **Connect Google** on the **Apps** page.
   - Google shows **"Google hasn't verified this app"** because AgentOS is a student project. Click **Advanced → Go to AgentOS (unsafe)**.
   - **Tick every permission box** (Calendar, Gmail send, Drive files AgentOS creates, Forms). AgentOS can only touch events, emails, documents and forms it creates.
4. Start a mission from **New mission**, or pick one of the example goals on the dashboard:
   - *"Coffee with `<your email>` tomorrow at 10 am, send them the invite"*: creates a Calendar event and emails the invitation.
   - *"Find 5 software engineering internships for students in India and save a shortlist to a Google Doc"*: researches the web with sources, then creates a Doc.
   - *"Create a registration form for our hackathon on Saturday"*: creates a Google Form.
5. AgentOS **pauses for your approval** before it creates or sends anything. You can **Approve**, **Edit** (change the time, recipients or text) or **Reject**.
6. When the mission completes, open the **proof links**: the real event, the sent email, the Doc and the Form in your own Google account. The proof panel shows how AgentOS checked each one with Google.

You can disconnect Google at any time on the **Apps** page; AgentOS then revokes its access at Google.

Prefer not to sign in? **Try Demo** runs a scripted, fully simulated mission in the browser (labelled as simulated everywhere).

---

## What is real

| Capability | Live Mode (signed in) |
|---|---|
| Planning | **AI planner**. Gemini by default, with fallbacks across several Gemini models, then Groq, then a deterministic rule-based planner, so a plan always comes back. |
| Google Calendar | **Real**. Checks free time, creates and updates events, and re-reads them to verify. |
| Gmail | **Real send**. The email is prepared in AgentOS, shown to you in the approval, sent with `gmail.send`, and Gmail's SENT confirmation is recorded. |
| Google Docs / Drive | **Real**. Creates documents, and can only access files AgentOS creates (`drive.file`). |
| Google Forms | **Real**. Creates forms and returns the responder link. |
| Web research | **Real**. `web.search` uses Gemini + Google Search grounding, then Groq web search, then Wikipedia. Every finding comes with its source link. |
| Approvals | **Real**. A mission stops until you decide. Edits change exactly what is created or sent. |
| Verification | **Real**. Results are re-fetched from Google by id. The proof panel shows how each item was checked. |
| Steps with no real tool (e.g. posting to Discord) | Run as a **clearly marked simulation**, never presented as done. |

---

## Safety

- **Approval before impact.** Any step that creates, sends or publishes something needs your approval:
  - the plan schema refuses plans that skip it;
  - the policy engine requires it for every high-risk tool, whatever the plan says.
- **Untrusted input.** Goals, emails, documents and web pages are treated as data. The AI only writes a plan that is validated against the tool registry, and unknown tools are rejected. Tested with injected "ignore previous instructions" text.
- **Accounts and isolation.**
  - Passwords are hashed with scrypt.
  - Sessions use an httpOnly SameSite cookie, stored as a hash.
  - Every mission, approval and proof is visible only to its owner (other users get 404).
  - Cross-site writes are refused.
- **Google tokens.**
  - OAuth uses PKCE and a sealed, single-use `state` tied to the user.
  - Tokens are encrypted at rest (Fernet, with key rotation) and never sent to the browser or written to logs. A test scans every response, event and log line for them.
  - Scopes are minimal: `calendar.events`, `gmail.send`, `drive.file`, `forms.body`.
- **Limits.**
  - Logins: 10 failed attempts per 5 minutes.
  - Per user: 30 AI plans and 20 new missions per hour.
  - Per mission: 30 tool calls.
  - Timeouts on every external call; only transient errors are retried, and a send whose outcome is unknown is never retried.
- **Security headers** on the website and the API (HSTS in production).

Privacy policy: [/privacy.html](https://agent-os-two-iota.vercel.app/privacy.html) · Terms: [/terms.html](https://agent-os-two-iota.vercel.app/terms.html)

---

## Architecture

```
Browser (React, Vercel) ──/api──▶ FastAPI backend (Render) ──▶ Postgres (Neon)
                                       │
           goal ─▶ AI planner ─▶ validated MissionPlan (tasks, deps, approvals, criteria)
                                       │
           background worker ─▶ agents ─▶ policy check ─▶ approval? ─▶ real tool
                                       │                                   │
           live event stream ◀─ events, evidence ◀─ verification ◀─────────┘
```

- **Frontend** (`src/`): React 18, Vite, Tailwind, React Flow.
  - Live missions stream events over SSE (`src/live/`).
  - The same mission engine also powers the offline Demo (`src/engine/`, `src/agentos/`).
- **Backend** (`backend/app/`): FastAPI, SQLAlchemy 2, Alembic.
  - `services/planner.py`: AI planner with model and provider fallbacks.
  - `services/runner.py`: task-by-task execution, policy, approvals, retries, idempotency.
  - `services/worker.py`: missions run in the background, so requests never wait on Google.
  - `policy/`: per-app permissions and risk.
  - `tools/`: Calendar, Gmail, Drive, Forms and web tools, each with `execute` and an independent `verify`.
  - `services/verification.py`: the proof bundle and re-verify.
- **Hosting** (all free tiers):
  - the website on Vercel, which proxies `/api` to Render, so cookies stay first-party;
  - the backend on Render;
  - the database on Neon;
  - a keep-awake ping from GitHub Actions.
  - See [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Run locally

Requires Node.js 18+ and Python 3.12.

```bash
git clone https://github.com/ALN-web/AgentOS.git
cd AgentOS
npm install
npm run dev            # Demo Mode only, http://localhost:3000
```

For Live Mode, set up the backend as described in [backend/README.md](backend/README.md). You need a Google OAuth client, an encryption key and, optionally, a Gemini key. Then run:

```bash
npm run dev:live       # website on http://localhost:3100, talking to the backend on :8000
```

## Testing

```bash
npm test                                   # 215 frontend tests (Vitest)
npm run build
cd backend && python -m pytest             # 308 backend tests
```

The backend tests run full missions against a fake Google. They cover:

- OAuth;
- approvals: approve, edit, reject and replay;
- verification and re-verify;
- recovery;
- background runs;
- per-user isolation;
- prompt injection;
- secret scanning;
- rate limits;
- the AI planner and its fallbacks;
- web research.

CI runs both suites, plus dependency audits, on every pull request.

---

## Limitations

- Google shows "unverified app" until Google completes its review (up to 100 test users until then).
- The free backend can take up to a minute to wake after a long idle period. A ping every 5 minutes keeps it awake.
- Free AI quotas are shared by all users. When they run out, AgentOS falls back to another model or provider, and finally to the rule-based planner.
- Steps without a real tool (for example Discord posts or browser automation) are simulated and labelled as simulated.

## License

MIT License. © 2026 AgentOS.
