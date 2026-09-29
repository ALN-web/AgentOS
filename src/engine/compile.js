// Compiles any MissionPlan into the step script the engine runs.
//
// This is the only bridge between planning and execution: the engine does not
// know about domains, blueprints or goals. Tool work is simulated here (Demo
// Mode). Every message comes from the plan's data, so a different goal yields
// a different mission through exactly the same machinery.

import { ops } from './ops';
import { FAILURE_CLASSES } from '../agentos/recovery';
import { CAPABILITY_BY_ID } from '../agentos/capabilities';
import { AGENT_BY_ID } from '../data/agents';

const { say, status, addTask, task, metricSet, metricAdd, browse, bstep, check, recovery, replaceTask, dropDep } = ops;
const s = (delay, ...fns) => ({ delay, run: (m) => fns.reduce((acc, f) => f(acc), m) });

const name = (agent) => AGENT_BY_ID[agent]?.name || agent;
const EVENT_TYPE = { compare: 'critique', create: 'action', draft: 'action', browse: 'action', search: 'action', monitor: 'action' };
const ACTION = { communicate: 'Outreach', submit: 'Submission', purchase: 'Order' };
const audienceOf = (p) => (p.recipients != null ? `${p.recipients} ${p.audience}` : p.to);

// Only the fields the engine and UI need on a live task.
const record = (t) => ({
  id: t.id,
  title: t.title,
  agent: t.agent,
  deps: t.deps,
  gated: t.gated,
  type: t.type,
  capability: t.capability,
  why: t.why,
  ...(t.countsFor ? { countsFor: t.countsFor } : {}),
});

export function compilePlan(plan) {
  const { intent, tasks, criteria, metric, failure } = plan;
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const backsCriterion = new Set(criteria.map((c) => c.taskId));

  // What completing a task changes, beyond its status.
  const finish = (t) => {
    const key = t.countsFor || t.id;
    const src = byId[key] || t;
    const fns = [task(t.id, { status: 'done' })];
    if (metric.kind === 'quantity' && src.progress != null) fns.push(metricSet(Math.round(metric.target * src.progress)));
    if (metric.kind === 'criteria' && backsCriterion.has(key)) fns.push(metricAdd(1));
    return fns;
  };

  let lastAgent = null;
  const handoff = (t) => {
    const fns = [];
    if (t.agent !== lastAgent && t.agent !== 'execution' && t.agent !== 'planner') {
      fns.push(say('execution', `${name(t.agent)}, you’re up: ${t.title.charAt(0).toLowerCase()}${t.title.slice(1)}.`));
    }
    lastAgent = t.agent;
    return fns;
  };

  const browserSteps = (t, list) => list.map((text) => s(900, bstep(text)));

  function normalTask(t) {
    const out = [s(800, task(t.id, { status: 'running' }), ...handoff(t))];
    if (t.site) {
      out.push(s(700, browse({ url: `https://${t.site}/`, title: t.siteTitle || t.site })));
      out.push(...browserSteps(t, t.steps || []));
    }
    out.push(s(1300, ...finish(t), say(t.agent, t.out || `${t.title}: done.`, EVENT_TYPE[t.type] || 'message')));
    return out;
  }

  function gatedTask(t) {
    const approve = ({ edited, payload }) => [
      s(600, say('approval', edited ? 'Approved with your edits. Resuming.' : 'Approved. Resuming the mission.', 'approval'), status('running'), task(t.id, { status: 'running' })),
      s(1500, ...finish(t), say(t.agent, `${ACTION[t.type] || 'Action'} simulated successfully: “${payload.subject}” to ${audienceOf(payload)}.`, 'action')),
    ];
    const reject = () => [
      s(600, say('approval', 'Rejected. Nothing will be sent.', 'approval'), status('running'), task(t.id, { status: 'skipped' }), dropDep(t.id)),
      s(1100, say('planner', `Re-planned without “${t.title}”. It stays prepared as a draft for you to send yourself.`, 'plan')),
    ];
    return [
      s(800, task(t.id, { status: 'awaiting' }), ...handoff(t), say('approval', `“${t.title}” has consequences outside AgentOS. Pausing for your approval.`, 'approval')),
      {
        delay: 300,
        approval: { title: t.title, agent: 'approval', risk: t.risk, category: t.category, reason: t.why.reason, payload: t.payload },
        approve,
        reject,
      },
    ];
  }

  function failingTask(t) {
    const cls = FAILURE_CLASSES[failure.cls];
    const alt = failure.alt;
    const error = cls.error(failure.site);
    const steps = t.steps || [];
    const out = [s(800, task(t.id, { status: 'running' }), ...handoff(t))];
    if (t.site) {
      out.push(s(700, browse({ url: `https://${t.site}/`, title: t.siteTitle || t.site })));
      out.push(...browserSteps(t, steps.slice(0, 1)));
    }
    out.push(
      s(1200, ...(t.site ? [bstep(`Stopped: ${cls.label.toLowerCase()}`, 'failed')] : []), task(t.id, { status: 'failed' }), status('recovering'),
        say(t.agent, error, 'failure'),
        recovery({ id: 'r1', task: t.title, error, failureClass: cls.label, status: 'diagnosing' })),
      s(1300, say('recovery', `Failure detected in “${t.title}”. Classifying it…`, 'recovery')),
      s(1500, recovery({ id: 'r1', diagnosis: `${cls.label} (${cls.transient ? 'transient' : 'persistent'}). ${cls.diagnosis}`, status: 'replanning' }),
        say('recovery', `Failure class: ${cls.label}. ${cls.diagnosis}`, 'recovery')),
      s(1500, recovery({ id: 'r1', plan: `${cls.plan} Capability: ${CAPABILITY_BY_ID[alt.capability].name}.`, status: 'retrying' }),
        say('recovery', `Alternative: ${cls.plan}`, 'recovery')),
      s(900, replaceTask(t.id, record(alt)),
        say('planner', `Plan updated: “${t.title}” is replaced by “${alt.title}”, assigned to the ${name(alt.agent)} agent.`, 'plan')),
      s(700, task(alt.id, { status: 'running' }), say('execution', 'Resuming with the new approach.', 'action')),
      ...(t.site ? browserSteps(t, ['Retried with the new approach', ...steps.slice(1)]) : []),
      s(1200, ...finish(alt), recovery({ id: 'r1', status: 'resolved' }), status('running'), say(alt.agent, t.out || `${alt.title}: done.`, 'action')),
      s(700, say('recovery', `Recovered. “${t.title}” was completed another way. Mission back on track.`, 'recovered')),
    );
    lastAgent = alt.agent;
    return out;
  }

  function verifyTask(t) {
    const out = [s(900, task(t.id, { status: 'running' }), ...handoff(t), say('verification', 'Checking every success criterion…'))];
    criteria.forEach((c) => {
      out.push(
        s(700, (m) => {
          const done = m.tasks.some((x) => (x.id === c.taskId || x.countsFor === c.taskId) && x.status === 'done');
          return check(done ? c.label : `${c.label}: not done`, done ? 'done' : 'warn')(m);
        }),
      );
    });
    if (metric.kind === 'quantity') out.push(s(700, check((m) => `${m.metric.current} of ${metric.target} ${intent.quantity.unit} verified (simulated)`)));
    out.push(
      s(1000, task(t.id, { status: 'done' }), say('verification', (m) => {
        const open = m.checks.filter((c) => c.status !== 'done').length;
        return open
          ? `Verified, with ${open} open item${open === 1 ? '' : 's'} left for you. Everything else meets the criteria.`
          : `Verified: every success criterion is met${metric.kind === 'quantity' ? ` (${m.metric.current} ${intent.quantity.unit})` : ''}.`;
      }, 'verified')),
    );
    return out;
  }

  const names = plan.capabilities.map((c) => CAPABILITY_BY_ID[c]?.name).filter(Boolean);
  const script = [
    s(500, say('system', `Mission received: “${plan.goal}”`, 'system')),
    s(1200, say('planner', `Goal understood: ${intent.objective}. Domain: ${intent.domainLabel}. Success means: ${intent.desiredOutcome}.`, 'plan')),
    ...(plan.assumptions.length ? [s(900, say('planner', `Assumptions: ${plan.assumptions.join('; ')}.`))] : []),
    s(900, say('planner', `Capabilities selected: ${names.join(', ')}.`)),
    ...tasks.map((t) => s(260, addTask(record(t)))),
    s(700, say('planner', `Plan ready: ${tasks.length} tasks, ${plan.approvalPoints} approval point${plan.approvalPoints === 1 ? '' : 's'}, ${criteria.length} success criteria.`, 'plan'), status('running')),
  ];
  for (const t of tasks) {
    if (t.type === 'verify') script.push(...verifyTask(t));
    else if (t.gated) script.push(...gatedTask(t));
    else if (failure && t.id === failure.taskId) script.push(...failingTask(t));
    else script.push(...normalTask(t));
  }
  script.push(s(800, status('completed'), say('system', `Simulated mission complete: ${intent.desiredOutcome}.`, 'complete')));

  return { script, metric: { label: metric.label, current: 0, target: metric.target } };
}
