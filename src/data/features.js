import {
  Activity,
  Wand2,
  BadgeCheck,
  Clapperboard,
  GitBranch,
  Lightbulb,
  MousePointerClick,
  Network,
  RotateCcw,
  Shuffle,
  UserCheck,
  Calendar,
} from 'lucide-react';

// The capability catalogue behind /app/features. Add a feature by adding an entry.
//
// `see` says where the feature can be seen working:
//   { to, label }            a page in the console
//   { demo: true, label }    opens the demo mission (starting it if needed)
//   { replay: true, label }  opens the latest completed mission (falls back to the demo)
//   { launcher: true, label } opens the mission launcher with an empty goal
// `note` is shown when the demo simulates part of the feature.

export const FEATURES = [
  {
    id: 'any-goal',
    icon: Wand2,
    title: 'Start Any Mission',
    tagline: 'Goals, not predefined workflows.',
    description:
      'Describe any outcome in your own words. AgentOS turns it into a mission intent (objective, success criteria, risks, required capabilities) and plans from that. Templates are only starting points.',
    points: ['Structured intent from free text', 'Asks only for missing critical details', 'Unfamiliar goals still get a plan'],
    note: 'Demo Mode plans with deterministic goal analysis in your browser. An LLM planner can return the same plan shape later.',
    see: { launcher: true, label: 'Try any goal' },
  },
  {
    id: 'everyday-apps',
    icon: Calendar,
    title: 'Everyday Apps',
    tagline: 'Email, calendar, and beyond.',
    description: 'AgentOS integrates with everyday tools to read your schedule, draft emails, and handle daily admin, keeping you in the loop for anything important.',
    points: ['Drafts and reads email', 'Manages calendar events', 'Sets reminders for tasks'],
    see: { launcher: true, goal: 'Plan my week around my deadlines', label: 'Plan my week' },
  },
  {
    id: 'planning',
    icon: GitBranch,
    title: 'Autonomous Planning',
    tagline: 'Turn goals into executable plans.',
    description: 'The Planner reads one sentence, decides what “done” means, and builds a dependency-ordered task graph with an owner for every task.',
    points: ['Success defined as a measurable target', 'Independent tasks run in parallel', 'Every task has an owner and a reason'],
    see: { demo: true, label: 'Watch a plan get built' },
  },
  {
    id: 'collaboration',
    icon: Network,
    title: 'Multi-Agent Collaboration',
    tagline: 'Specialized agents coordinate to achieve outcomes.',
    description: 'Eight agents with distinct roles hand work to each other. Execution coordinates; the others plan, research, act, critique, verify, recover and ask.',
    points: ['Eight specialised roles', 'Live view of who is working', 'Hand-offs visible in the activity log'],
    see: { to: '/app/workforce', label: 'Open the workforce' },
  },
  {
    id: 'browser',
    icon: MousePointerClick,
    title: 'Browser Automation',
    tagline: 'Agents operate web interfaces.',
    description: 'The Browser agent works through websites step by step: opening pages, filling forms and publishing, with every action logged.',
    points: ['Step-by-step action history', 'Current page and action always visible', 'Failures surface immediately'],
    note: 'In this demo the browser steps are scripted, not a live browser session.',
    see: { demo: true, label: 'See the browser agent work' },
  },
  {
    id: 'hitl',
    icon: UserCheck,
    title: 'Human-in-the-Loop',
    tagline: 'Sensitive actions require approval.',
    description: 'Before an agent emails people, pays or submits in your name, the mission pauses. You see the exact action, why it is risky, and can approve, edit or reject it.',
    points: ['Exact payload shown before it runs', 'Edits change what actually happens', 'Rejections trigger a new plan'],
    see: { to: '/app/approvals', label: 'Open approvals' },
  },
  {
    id: 'recovery',
    icon: RotateCcw,
    title: 'Failure Recovery',
    tagline: 'Agents detect failures and adapt.',
    description: 'When something breaks, the Recovery agent diagnoses the root cause, designs an alternative, and hands it to the Planner, instead of retrying blindly.',
    points: ['Root cause, not just the error', 'Alternative strategy, not a blind retry', 'Time to recover is measured'],
    see: { demo: true, label: 'Watch a recovery' },
  },
  {
    id: 'verification',
    icon: BadgeCheck,
    title: 'Verification',
    tagline: 'Results are independently checked.',
    description: 'The Verification agent does not trust anyone’s output. It counts, removes duplicates and bad data, and only then declares the goal met.',
    points: ['Checks every output', 'Removes duplicates and invalid data', 'Falls short? The plan grows a new task'],
    see: { demo: true, label: 'See verification run' },
  },
  {
    id: 'explainability',
    icon: Lightbulb,
    title: 'Explainability',
    tagline: 'Understand why agents took actions.',
    description: 'Click any task or event to see the agent, its objective, its reason, the evidence from the mission, and what happened next.',
    points: ['Objective and reason for every task', 'Evidence pulled from the mission itself', 'What the action led to'],
    note: 'Reasons are written with the demo script, not generated live by a model.',
    see: { demo: true, label: 'Try “Why?” on any event' },
  },
  {
    id: 'replay',
    icon: Clapperboard,
    title: 'Mission Replay',
    tagline: 'Watch the entire execution lifecycle.',
    description: 'Replay a finished mission at 1×, 2× or 4×, or scrub to any moment. Every panel shows the mission exactly as it was, including your decisions.',
    points: ['Play, pause, restart and scrub', 'Your approvals replayed as you made them', 'Same engine as the live run'],
    see: { replay: true, label: 'Replay a mission' },
  },
  {
    id: 'adaptive',
    icon: Shuffle,
    title: 'Adaptive Execution',
    tagline: 'Plans change when circumstances change.',
    description: 'A rejected approval, a blocked channel or a result short of the target all change the plan mid-mission. New tasks appear in the graph as they are added.',
    points: ['Re-plans after a rejection', 'Adds tasks when the target is missed', 'The task graph updates live'],
    see: { demo: true, label: 'See the plan adapt' },
  },
  {
    id: 'outcomes',
    icon: Activity,
    title: 'Outcome Tracking',
    tagline: 'Completed outcomes, not isolated actions.',
    description: 'Every mission tracks one metric against its target, and ends only when the result is verified, with a report of what was done and how.',
    points: ['One target per mission', 'Progress toward it, live', 'An outcome report at the end'],
    see: { to: '/app', label: 'Open the dashboard' },
  },
];
