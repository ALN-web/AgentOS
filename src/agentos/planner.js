// Mission planning: goal -> Mission Intent -> Mission Plan.
//
// A MissionPlan is plain, serialisable data, stored on the mission:
// {
//   kind: 'dynamic' | 'hero', planner, goal, intent,
//   tasks: [{ id, title, type, capability, agent, deps, gated, risk, category,
//             why, out, criterion, progress, site, siteTitle, steps, payload }],
//   criteria: [{ label, taskId }], metric: { kind, label, target },
//   approvalPoints, capabilities, riskLevel, assumptions,
//   failure: { taskId, cls, site, alt } | null
// }
// The engine compiles any plan into executable steps, so the planner can be
// replaced (for example by an LLM planner that returns the same shape) without
// changing the engine or the mission UI.

import { analyzeGoal } from './intent';
import { BLUEPRINTS, RISK_STEPS } from './blueprints';
import { CAPABILITY_BY_ID, TASK_TYPES, agentOf, capabilityOf, isExternal } from './capabilities';
import { FAILURE_CLASSES } from './recovery';
import { DEMO_GOAL } from '../data/templates';
import { HERO_TASKS } from '../engine/scenarios';

const normalise = (goal) => goal.trim().toLowerCase().replace(/[.!\s]+$/, '').replace(/\s+/g, ' ');
export const isHeroGoal = (goal) => normalise(goal) === normalise(DEMO_GOAL);

// Deterministic "randomness": the same goal always yields the same plan.
function seed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const CATEGORY = {
  communication: 'External communication',
  submission: 'Submits in your name',
  purchasing: 'Spends money',
};

const DEFAULT_WHY = {
  objective: 'Carry out a required part of the goal.',
  reason: 'The plan needs this before the goal can be verified.',
};

function withRiskSteps(steps, intent, preferences) {
  const covered = new Set(steps.filter((s) => isExternal(s.type)).map((s) => TASK_TYPES[s.type].capability));
  const extra = [];
  for (const risk of intent.risks) {
    const tpl = RISK_STEPS[risk.id];
    if (!tpl) continue;
    const capId = TASK_TYPES[tpl.type].capability;
    if (covered.has(capId)) continue;
    covered.add(capId);
    const booking = risk.id === 'purchase' && /\b(book|reserve)\b/i.test(intent.goal);
    const addressed = risk.id === 'communication' && intent.recipient;
    const thing = intent.deliverable ? `the ${intent.deliverable.object}` : 'it';
    extra.push({
      ...tpl,
      ...(booking ? { title: 'Make the booking', payload: { ...tpl.payload, subject: 'Booking request' } } : {}),
      ...(addressed
        ? {
            title: `Send ${thing} to ${intent.recipient}`,
            payload: {
              ...tpl.payload,
              to: intent.recipientEmails || cap(intent.recipient),
              subject: intent.deliverable ? cap(intent.deliverable.object) : 'Update',
              body: `Hi,\n\nPlease find ${thing} attached.\n\n${preferences?.signature || 'Thanks'}`,
            },
          }
        : {}),
      key: `risk_${risk.id}`,
      why: { objective: `${risk.label}, as the goal asks.`, reason: 'This has consequences outside AgentOS, so it waits for your approval.' },
      criterion: `${booking ? 'Make the booking' : addressed ? `Send ${thing} to ${intent.recipient}` : tpl.title}: approved (simulated)`,
    });
  }
  if (!extra.length) return steps;
  const verifyAt = steps.findIndex((s) => s.type === 'verify');
  const before = steps.slice(0, verifyAt);
  const last = before[before.length - 1].key;
  extra.forEach((s, i) => (s.deps = [i === 0 ? last : extra[i - 1].key]));
  const verify = { ...steps[verifyAt], deps: [...steps[verifyAt].deps, extra[extra.length - 1].key] };
  return [...before, ...extra, verify, ...steps.slice(verifyAt + 1)];
}

function dynamicPlan(goal, answers, preferences = {}) {
  const intent = analyzeGoal(goal, answers, preferences);
  const steps = withRiskSteps(BLUEPRINTS[intent.domain](intent), intent, preferences);
  const idOf = Object.fromEntries(steps.map((s, i) => [s.key, `p${i + 1}`]));

  const tasks = steps.map((s) => {
    const capability = TASK_TYPES[s.type].capability;
    const gated = isExternal(s.type);
    const app = s.app || (capability === 'calendar' ? 'google-calendar' : capability === 'email' ? 'gmail' : capability === 'reminders' ? 'google-calendar' : null);
    const mappedInputs = s.inputs
      ? Object.fromEntries(
          Object.entries(s.inputs).map(([k, v]) => {
            if (typeof v === 'string' && v.includes('.')) {
              const [sourceKey, ...rest] = v.split('.');
              const sourceId = idOf[sourceKey] || sourceKey;
              return [k, [sourceId, ...rest].join('.')];
            }
            return [k, v];
          })
        )
      : null;

    const task = {
      id: idOf[s.key],
      title: s.title,
      type: s.type,
      capability,
      agent: agentOf(s.type),
      deps: s.deps.map((k) => idOf[k]).filter(Boolean),
      gated,
      risk: gated ? (capability === 'purchasing' ? 'high' : 'medium') : null,
      category: gated ? CATEGORY[capability] : null,
      why: s.why || DEFAULT_WHY,
      out: s.out || null,
      criterion: s.criterion || null,
      progress: s.progress ?? null,
      site: s.site || null,
      siteTitle: s.siteTitle || null,
      steps: s.steps || null,
      payload: s.payload || null,
      fail: !!s.fail,
    };
    if (app) task.app = app;
    if (mappedInputs && Object.keys(mappedInputs).length > 0) task.inputs = mappedInputs;
    return task;
  });

  const criteria = tasks.filter((t) => t.criterion).map((t) => ({ label: t.criterion, taskId: t.id }));
  const quantity = intent.quantity && tasks.some((t) => t.progress != null);
  const metric = quantity
    ? { kind: 'quantity', label: `Verified ${intent.quantity.unit}`, target: intent.quantity.n }
    : { kind: 'criteria', label: 'Success criteria met', target: criteria.length };

  // One deterministic failure, at a step that touches the outside world.
  const candidates = tasks.filter((t) => t.fail && !t.gated);
  const target = candidates[0] || tasks.find((t) => ['search', 'browse', 'research'].includes(t.type));
  let failure = null;
  if (target) {
    const cap = capabilityOf(target.type);
    const classes = cap.failures || ['source_unavailable'];
    const cls = classes[seed(intent.goal) % classes.length];
    const altCapability = (cap.alternatives || [cap.id])[0];
    failure = {
      taskId: target.id,
      cls,
      site: target.site || 'The source',
      alt: {
        id: `${target.id}b`,
        title: FAILURE_CLASSES[cls].altTitle(target.title),
        type: target.type,
        capability: altCapability,
        agent: CAPABILITY_BY_ID[altCapability].agent,
        deps: target.deps,
        gated: false,
        why: {
          objective: target.why.objective,
          reason: `Replaces “${target.title}”, which failed (${FAILURE_CLASSES[cls].label.toLowerCase()}). ${FAILURE_CLASSES[cls].plan}`,
        },
        countsFor: target.id,
      },
    };
  }

  const approvalPoints = tasks.filter((t) => t.gated).length;
  const riskLevel = tasks.some((t) => t.risk === 'high') ? 'high' : approvalPoints ? 'medium' : 'low';
  const capabilities = [...new Set(['planning', ...tasks.map((t) => t.capability), ...(failure ? ['recovery'] : []), ...(approvalPoints ? ['approval'] : [])])];

  return {
    kind: 'dynamic',
    planner: 'demo',
    goal: intent.goal,
    intent,
    tasks,
    criteria,
    metric,
    approvalPoints,
    capabilities,
    riskLevel,
    assumptions: intent.assumptions,
    failure,
  };
}

// The hero mission keeps its hand-authored script. Its plan describes that
// script in the same shape, so the launcher and mission page treat it alike.
function heroPlan(goal) {
  const intent = {
    ...analyzeGoal(goal),
    domain: 'outreach',
    domainLabel: 'Growth & outreach',
    desiredOutcome: '100 verified, unique registrations',
    questions: [],
    assumptions: [],
  };
  const TYPE = { research: 'research', browser: 'browse', critic: 'compare', verification: 'verify' };
  const tasks = HERO_TASKS.map((t) => ({
    id: t.id,
    type: TYPE[t.agent] || (t.gated ? 'communicate' : 'draft'),
    title: t.title,
    agent: t.agent,
    deps: t.deps,
    gated: !!t.gated,
    why: t.why,
    capability: { research: 'research', browser: 'browser', execution: t.gated ? 'communication' : 'document', critic: 'analysis', verification: 'verification' }[t.agent],
  }));
  return {
    kind: 'hero',
    planner: 'curated',
    goal,
    intent,
    tasks,
    criteria: [{ label: '100 verified, unique registrations', taskId: 't7' }],
    metric: { kind: 'quantity', label: 'Verified registrations', target: 100 },
    approvalPoints: 1,
    capabilities: ['planning', 'research', 'browser', 'document', 'analysis', 'communication', 'verification', 'recovery', 'approval'],
    riskLevel: 'medium',
    assumptions: [],
    failure: { taskId: 't6', cls: 'access_blocked', site: 'Discord' },
  };
}

export const demoPlanner = {
  id: 'demo',
  label: 'Demo planner',
  description: 'Deterministic goal analysis and planning heuristics. Runs in the browser, no API key.',
  plan(goal, answers = {}, preferences = {}) {
    return isHeroGoal(goal) ? heroPlan(goal) : dynamicPlan(goal, answers, preferences);
  },
};

// A live planner (an LLM returning a MissionPlan) would be registered here.
// Only planners that are actually implemented are listed.
export const PLANNERS = { demo: demoPlanner };

export function planMission(goal, answers = {}, planner = PLANNERS.demo, preferences = {}) {
  return planner.plan(goal, answers, preferences);
}
