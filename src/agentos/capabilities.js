// Capability registry: what AgentOS can do, which agent does it, and how.
//
// The planner reasons about capabilities, never about specific problems.
// Every capability has a `demo` implementation (deterministic, simulated in
// the browser). A live deployment registers a `live` tool for the same id
// (a real API, an MCP server, a Playwright browser) without touching the
// planner or the mission UI. None are connected in this build.

export const CAPABILITIES = [
  {
    id: 'planning',
    name: 'Planning',
    agent: 'planner',
    description: 'Turn a goal into tasks, dependencies and success criteria.',
    external: false,
  },
  {
    id: 'research',
    name: 'Research',
    agent: 'research',
    description: 'Gather and validate information.',
    external: false,
    failures: ['source_unavailable'],
    alternatives: ['search'],
  },
  {
    id: 'search',
    name: 'Web Search',
    agent: 'browser',
    description: 'Find candidates, listings and sources on the web.',
    external: false,
    failures: ['access_blocked', 'source_unavailable'],
    alternatives: ['research'],
  },
  {
    id: 'browser',
    name: 'Browser Automation',
    agent: 'browser',
    description: 'Interact with web interfaces: navigate, fill forms, publish.',
    external: false,
    failures: ['page_changed', 'access_blocked'],
    alternatives: ['browser', 'document'],
  },
  {
    id: 'analysis',
    name: 'Analysis & Review',
    agent: 'critic',
    description: 'Compare options, filter, and review work before it ships.',
    external: false,
  },
  {
    id: 'document',
    name: 'Document Creation',
    agent: 'execution',
    description: 'Create plans, shortlists, reports and other structured documents.',
    external: false,
  },
  {
    id: 'communication',
    name: 'Communication',
    agent: 'execution',
    description: 'Send email, messages and announcements.',
    external: true,
    failures: ['rate_limited'],
    alternatives: ['communication'],
  },
  {
    id: 'submission',
    name: 'Submission',
    agent: 'browser',
    description: 'Submit forms and applications on your behalf.',
    external: true,
    failures: ['validation_error'],
    alternatives: ['submission'],
  },
  {
    id: 'purchasing',
    name: 'Purchasing & Booking',
    agent: 'execution',
    description: 'Place orders, pay, and make bookings.',
    external: true,
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    agent: 'execution',
    description: 'Track progress toward the target over time.',
    external: false,
  },
  {
    id: 'verification',
    name: 'Verification',
    agent: 'verification',
    description: 'Check results against the success criteria.',
    external: false,
  },
  {
    id: 'recovery',
    name: 'Recovery',
    agent: 'recovery',
    description: 'Diagnose failures and find another way to finish the task.',
    external: false,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    agent: 'execution',
    description: 'Manage calendar events and availability.',
    external: true,
  },
  {
    id: 'email',
    name: 'Email',
    agent: 'execution',
    description: 'Manage inbox and send emails.',
    external: true,
  },
  {
    id: 'reminders',
    name: 'Reminders',
    agent: 'execution',
    description: 'Set and manage reminders.',
    external: true,
  },
  {
    id: 'approval',
    name: 'Human Approval',
    agent: 'approval',
    description: 'Pause before anything with external consequences.',
    external: false,
  },
];

export const CAPABILITY_BY_ID = Object.fromEntries(CAPABILITIES.map((c) => [c.id, c]));

// Reusable task types. A plan is a graph of these; each maps to a capability,
// and through it to an agent.
export const TASK_TYPES = {
  analyze: { label: 'Analyze', capability: 'planning' },
  research: { label: 'Research', capability: 'research' },
  search: { label: 'Search', capability: 'search' },
  compare: { label: 'Compare', capability: 'analysis' },
  create: { label: 'Create', capability: 'document' },
  draft: { label: 'Draft', capability: 'document' },
  browse: { label: 'Browse', capability: 'browser' },
  communicate: { label: 'Communicate', capability: 'communication' },
  submit: { label: 'Submit', capability: 'submission' },
  purchase: { label: 'Purchase', capability: 'purchasing' },
  monitor: { label: 'Monitor', capability: 'monitoring' },
  verify: { label: 'Verify', capability: 'verification' },
  recover: { label: 'Recover', capability: 'recovery' },
  schedule: { label: 'Schedule', capability: 'calendar' },
  inbox: { label: 'Inbox', capability: 'email' },
  remind: { label: 'Remind', capability: 'reminders' },
};

export const capabilityOf = (type) => CAPABILITY_BY_ID[TASK_TYPES[type].capability];
export const agentOf = (type) => capabilityOf(type).agent;
export const isExternal = (type) => !!capabilityOf(type).external;

// Which implementation serves each capability right now. Demo Mode only.
export const TOOL_MODE = 'demo';
