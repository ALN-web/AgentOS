# AgentOS — Autonomous AI Workforce

> *"Don't tell AI what to do. Tell it what you want done."*

Turn goals into completed outcomes through planning, execution, verification, recovery, and autonomous multi-agent collaboration.

---

## 🌟 What's in the demo

AgentOS is a frontend demo. The agents follow a deterministic, scripted mission engine (`src/engine/`) — there is no backend and no live LLM call. Everything on screen is derived from that engine's state.

- **Mission Control** (`/app/missions/:id`): goal, status, current objective, active agents, tasks, elapsed time, recoveries and approval state.
- **Mission plan**: a live task graph with owners, durations, dependencies and approval gates.
- **Agent activity timeline**: every agent action, timestamped. Click any event or task for **"Why did the agent do this?"**.
- **Failure → Recovery**: the hero mission always hits a real-looking failure (Discord blocks links); the Recovery agent diagnoses it, the Planner re-plans, Execution resumes.
- **Human approval**: risky actions pause for approve / edit / reject. Edits change what actually happens next (e.g. 480 → 320 recipients).
- **Outcome report** and **Mission replay** (1×/2×/4×, scrubbable) for finished missions.
- **Workforce graph** (`/app/workforce`), **Approvals** (`/app/approvals`), **Features hub** (`/app/features`), **Templates**.

Hero demo goal: **"Get 100 registrations for our hackathon"**.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn / pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/ALN-web/AgentOS.git
cd AgentOS

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Typography**: Plus Jakarta Sans, Space Grotesk, Inter

---

## 📄 License

MIT License. © 2026 AgentOS Inc.
