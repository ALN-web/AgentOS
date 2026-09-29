# AgentOS — Autonomous AI Workforce

> *"Don't tell AI what to do. Tell it what you want done."*

You give AgentOS a goal. A team of specialised agents plans it, does the work, asks you before anything risky, recovers when something breaks, and verifies the result before calling the mission done.

**AgentOS isn't a collection of predefined workflows.** It turns arbitrary goals into executable missions: goal → mission intent → plan → task graph → agents → execution → verification, with approval and recovery built in. Templates are only starting points.

---

## What this submission is

**Current demo: AgentOS demonstrates autonomous mission planning and execution using deterministic simulated tools.**
Everything runs in the browser. There is no backend, no database, no login, no API key and no LLM call. Any goal you type is analysed and planned by a deterministic demo planner (`src/agentos/`), compiled into steps for the mission engine (`src/engine/`), and every panel on screen is derived from that engine's state. Actions like sending email, publishing a form or posting to Discord are **simulated**, and the UI labels them that way.

**Future production system: real agents.**
An LLM planner that returns the same mission plan, and real API, MCP and browser tools connected through the capability registry, running on a backend. None of that is in this repository yet; the seams for it are.

The demo exists to show the product experience: how a user hands off a goal and stays in control while agents do the work.

---

## Try it

1. Open the site and click **Launch Mission**. The launcher is prefilled with the hero goal, *"Get 100 registrations for our college hackathon"*. Press **Analyze goal** to see how AgentOS understood it, then **Start mission**. (Or click **Try Demo Mission** to jump straight in.)
2. Watch the **Planner** build a 7-task plan, then Research, Browser, Execution and Critic agents work through it. Use **1× / 2× / 4×** to change speed, and pause or restart at any time.
3. The mission **pauses for approval** before simulating an email to 480 people. Choose:
   - **Approve** — the mission continues as planned.
   - **Edit** — change the recipients (for example to 320), the subject or the message; every later step uses your edited values.
   - **Reject** — nothing is sent; the Planner re-plans through club leads instead.
4. A **failure** follows: the simulated Discord server blocks links from new accounts. Watch the **Recovery** agent diagnose it, design an alternative (a QR-code image), the **Planner** update the plan and **Execution** resume.
5. **Verification** finds too few valid sign-ups, the plan adds a reminder task, and the mission completes at a simulated **104 / 100**.
6. Read the **outcome report**, then click **See how AgentOS worked** to **replay** the mission at any speed or scrub to any moment.
7. Click any event or task for **"Why did the agent do this?"**

### Try any goal

Click **New mission** and type anything, for example *"Organize a hackathon in our college"*, *"Find 20 internship opportunities for me"*, *"Research our top 3 competitors"*, or something no template covers, like *"Write a newsletter about our new cafeteria menu and email it to all staff"*. **Analyze goal** shows:

- **Mission understood:** objective, domain, what success means
- **Likely capabilities** and an **estimated plan** (tasks, approval points, success criteria, risk)
- **Clarifying questions**, only when critical details are missing; answering them re-plans instantly, skipping uses stated assumptions
- **Review plan:** every task, its agent, and which ones need approval

Different goals produce different plans. Every mission runs through the same engine: approvals gate actions with external consequences, one step fails and is recovered generically (classify the failure → choose another capability → replace the task in the graph → resume), and verification checks the plan's success criteria.

Missions are saved in your browser, so refreshing keeps your progress (a pending approval stays pending). **Reset demo data** in the sidebar or dashboard returns to a clean start.

---

## The 10 features

| Feature | Where | What it shows |
|---|---|---|
| Live Mission Control | `/app/missions/:id` | Goal, status, start time, current objective, active agents, tasks, elapsed time, recoveries, approval state |
| Agent Activity Timeline | Mission page | Every agent action, timestamped, in order |
| Agent Collaboration Graph | `/app/workforce` | 8 agents with role, state, current task and confidence; the Recovery → Planner → Execution path lights up during a failure |
| Failure → Recovery | Mission page | Failed action, detection, root cause, alternative, plan update, resumed execution, verification |
| Human Approval Center | `/app/approvals` and mission page | Approve / edit / reject that genuinely controls the mission, with an original-vs-modified diff |
| Mission Task Graph | Mission page | Dependencies, owners, durations, approval gates and live status |
| Explainability Drawer | Click any event or task | Agent, action, objective, reason, evidence from the mission, confidence, next step |
| Mission Outcome Report | Mission page, on completion | Result, tasks, agents, approvals, recoveries, verification, what was accomplished |
| Mission Replay | Completed missions | Play, pause, restart, 1×/2×/4×, scrubber; uses the same engine and your recorded decisions |
| Features Hub | `/app/features` | Every capability, each linking to where it can be seen |

---

## What is simulated, and what needs a backend

| Capability | In this demo | Needs for production |
|---|---|---|
| Goal understanding | Deterministic analysis: domain, quantities, dates, format, risks, missing details | LLM that returns the same mission intent |
| Planning | Blueprints for broad goal types, filled from the intent; a general blueprint for anything else | LLM planner returning the same mission plan |
| Agent actions (email, forms, posts) | Simulated; no external request is made | Tool / API integrations, credentials |
| Browser automation | Scripted steps in a "Simulated Browser Session" panel | Playwright (or similar) running server-side |
| Failure and recovery | Scripted failure; recovery follows real engine state | Real error detection and re-planning |
| Human approval | Real: it pauses the engine and changes what happens next | Same, plus notifications |
| Explanations | Written with the script, filled in from live mission data | Model-generated rationale with citations |
| Confidence values | Configured per agent | Model-derived scores |
| Persistence | This browser's localStorage | Database, accounts |

The hero goal keeps a hand-authored, curated plan so the headline demo is identical every time. Every other goal is planned dynamically.

---

## Architecture

```
USER GOAL → goal understanding → MISSION INTENT → planner → MISSION PLAN (tasks, deps,
capabilities, approval points, success criteria) → compiler → engine steps → agents
execute → verification → done, or failure → recovery → re-plan → execute
```

```
src/
  agentos/       Goal → plan. Plain data in, plain data out
    intent.js      Goal understanding → Mission Intent (+ clarifying questions, assumptions)
    capabilities.js Capability registry and task types (each capability → an agent)
    blueprints.js  Planning blueprints for broad goal types, filled from the intent
    planner.js     Planner registry; the demo planner builds the Mission Plan
    recovery.js    Failure classes: diagnosis and alternative strategy
  engine/        Pure mission engine: no React, no I/O
    compile.js     Compiles any Mission Plan into engine steps (simulated tools)
    engine.js      createMission, advance, resolveApproval, restartMission, replayTo
    ops.js         State operations used by scenarios (say, task, recovery, …)
    scenarios.js   Scripted scenarios: hero (registrations) and generic
    selectors.js   Derived views: active agents, objective, explanations, summary
  store/
    MissionStore.jsx  React context; one 120 ms ticker advances every mission
    persistence.js    Versioned, validated localStorage save/restore
  app/           Console pages (dashboard, missions, mission detail, workforce, …)
  components/    Shared UI (approval card, feature card, error boundary, …)
  landing/       Marketing page
  data/          Agents, templates and feature catalogue
```

- **Swappable parts.** The UI and engine only depend on the Mission Plan shape. A live planner (for example an LLM) registers in `PLANNERS` and returns the same shape; a live tool registers against a capability id in the registry. Only implemented planners and tools are listed; nothing in the UI pretends otherwise.
- A mission holds plain state, its plan, and a `script` of steps compiled from the plan. Each step is either a state update or an approval checkpoint whose approve/reject branch is spliced in when you decide.
- The engine is pure, so it is safe under React StrictMode, testable without a browser, and reusable for **replay**: `replayTo(mission, t)` re-runs the same script with your recorded decisions.
- Persistence stores only plain data. On load, scripts are recompiled from the stored plan and the recorded decisions; saved state from a different script version, or anything malformed, is discarded.

**Tech stack:** React 18, Vite 6, React Router 7, Tailwind CSS 3, React Flow (`@xyflow/react`), Framer Motion, Lucide icons, self-hosted Plus Jakarta Sans. Tests: Vitest.

---

## Run locally

Requires Node.js 18 or newer.

```bash
git clone https://github.com/ALN-web/AgentOS.git
cd AgentOS
npm install
npm run dev        # development server on http://localhost:3000
npm test           # engine and persistence tests
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Deployment

The app is a static single-page app. `vercel.json` sets the Vite framework, `npm ci`, `npm run build`, the `dist` output, and a rewrite of every path to `index.html` so direct links such as `/app/workforce` work on refresh. No environment variables are needed.

---

## 5 minute judging script

1. **(0:00) The idea.** "Most AI tools make you drive every step. AgentOS takes a goal and delivers an outcome, while you stay in control." Show the landing page's four steps.
2. **(0:30) Launch.** Click **Launch Mission**; the hero goal is prefilled. Launch it and set **2×**. Point out the header: goal, status, current objective, active agents.
3. **(1:00) Plan and collaboration.** The Planner builds the task graph; the form and the invite draft run in parallel. The Browser panel shows the simulated form build. The Critic rewrites the weak subject line.
4. **(1:45) Human control.** The mission stops: *Action requires approval*. Click **Edit**, change 480 recipients to 320, and approve. Show that later messages use 320.
5. **(2:30) Failure and recovery.** The simulated Discord post is rejected. Walk down the recovery card: root cause, alternative, Planner update, resumed execution. Open **Workforce** to show the red recovery path.
6. **(3:15) Verification and outcome.** Verification catches duplicates, the plan adds a reminder, and the outcome report shows the simulated 104 / 100 with everything that happened.
7. **(3:45) Any goal.** Click **New mission**, type a goal nobody prepared, press **Analyze goal**: show the mission intent, capabilities, plan and approval points. "Templates are starting points; the system plans from the goal." Start it and show a different plan running through the same engine.
8. **(4:15) Trust.** Click an event → **Why did the agent do this?** Then **Replay** at 4×.
9. **(4:40) Be clear.** "Planning and execution here are deterministic and simulated, in the browser. The next step is an LLM planner and real tools behind the same plan and capability interfaces."

---

## Current limitations

- Goal understanding uses keyword scoring and pattern extraction, not a language model; unusual phrasing can land in the general blueprint.
- Plans come from eight broad blueprints (events, careers, launches, research, procurement, outreach, operations, general), adapted to the goal; each dynamic mission includes one simulated failure to demonstrate recovery.
- No real external actions, accounts or data.
- Saved missions live in one browser; two open tabs do not sync with each other.

## Future architecture

A backend service running LLM agents (planner, executor, critic, verifier) with tool use, MCP integrations, server-side browser automation, a database for missions and audit logs, and the same approval and recovery model this interface already demonstrates.

---

## License

MIT License. © 2026 AgentOS.
