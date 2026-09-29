// Client-side mission engine.
//
// Each mission carries a `script`: an ordered list of steps. A step is either
//   { delay, run(mission) => mission }                   — a pure state update, or
//   { delay, approval, approve({ edited, payload }) => steps, reject() => steps }  — a pause for a human.
// The provider calls `advance` on a timer; approval branches are spliced into the
// script when the user decides. All functions here are pure so React can call
// them freely (StrictMode double-invocation included).

import { compileScript } from './scenarios';
import { planMission } from '../agentos/planner';

let seq = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const ACTIVE_STATUSES = ['planning', 'running', 'awaiting_approval', 'recovering'];

// `runId` changes on every (re)start, so ids of events and approvals from an
// earlier run never collide with the current one.
// `plan` is the MissionPlan from the planner; without one, the demo planner
// plans the goal with its assumptions.
export function createMission(goal, { templateId = null, createdAt = Date.now(), demo = false, plan = null, preferences = {} } = {}) {
  const missionPlan = plan || planMission(goal, {}, undefined, preferences);
  const { script, metric } = compileScript(missionPlan);
  return {
    id: uid('m'),
    runId: uid('r'),
    goal,
    templateId,
    demo,
    plan: missionPlan,
    status: 'planning',
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    clock: 0, // simulated mission time in ms, independent of playback speed
    speed: 1,
    paused: false,
    remaining: 0,
    metric,
    tasks: [],
    events: [],
    approvals: [],
    browser: { url: '', title: '', steps: [] },
    recoveries: [],
    checks: [],
    script,
    cursor: 0,
    nextAt: createdAt + script[0].delay,
  };
}

function applyStep(m, now) {
  const step = m.script[m.cursor];
  if (step.approval) {
    const approval = {
      ...step.approval,
      id: `${m.runId}_a${m.cursor}`,
      missionId: m.id,
      goal: m.goal,
      status: 'pending',
      requestedAt: now,
      stepIndex: m.cursor,
    };
    return { ...m, approvals: [...m.approvals, approval], status: 'awaiting_approval', updatedAt: now };
  }
  const ran = step.run({ ...m, clock: m.clock + step.delay });
  // Stamp new events with the wall-clock time they happened.
  const out =
    ran.events.length > m.events.length
      ? { ...ran, events: ran.events.map((e, i) => (i < m.events.length || e.at ? e : { ...e, at: now })) }
      : ran;
  const cursor = m.cursor + 1;
  const next = m.script[cursor];
  return {
    ...out,
    cursor,
    nextAt: now + (next ? next.delay / m.speed : 0),
    updatedAt: now,
    completedAt: out.status === 'completed' && !m.completedAt ? now : out.completedAt,
  };
}

export function advance(m, now) {
  if (m.paused || m.status === 'completed' || m.status === 'awaiting_approval') return m;
  let next = m;
  while (next.cursor < next.script.length && now >= next.nextAt && next.status !== 'awaiting_approval') {
    next = applyStep(next, now);
  }
  return next;
}

// decision: 'approve' | 'reject' | 'edit'
export function resolveApproval(m, approvalId, decision, edits, now) {
  const approval = m.approvals.find((a) => a.id === approvalId);
  if (!approval || approval.status !== 'pending') return m;
  const step = m.script[approval.stepIndex];
  const edited = decision === 'edit';
  // An edit changes what actually happens next: the branch runs with the edited payload.
  const payload = edited ? { ...approval.payload, ...edits } : approval.payload;
  const branch = decision === 'reject' ? step.reject() : step.approve({ edited, payload });
  const script = [
    ...m.script.slice(0, approval.stepIndex + 1),
    ...branch,
    ...m.script.slice(approval.stepIndex + 1),
  ];
  const cursor = approval.stepIndex + 1;
  const approvals = m.approvals.map((a) =>
    a.id === approvalId
      ? {
          ...a,
          status: decision === 'reject' ? 'rejected' : edited ? 'edited' : 'approved',
          payload,
          original: edited ? a.payload : undefined,
          resolvedAt: now,
        }
      : a
  );
  return {
    ...m,
    script,
    cursor,
    approvals,
    status: 'running',
    paused: false,
    nextAt: now + script[cursor].delay / m.speed,
    updatedAt: now,
  };
}

export function setSpeed(m, speed, now) {
  const ratio = m.speed / speed;
  // While paused the time left lives in `remaining`, not `nextAt`.
  if (m.paused) return { ...m, speed, remaining: m.remaining * ratio };
  return { ...m, speed, nextAt: now + Math.max(0, m.nextAt - now) * ratio };
}

// Starts the same mission over from its initial state, keeping its id and speed.
export function restartMission(m, now, preferences = {}) {
  const fresh = createMission(m.goal, { templateId: m.templateId, createdAt: now, demo: m.demo, plan: m.plan, preferences });
  return { ...fresh, id: m.id, speed: m.speed, nextAt: now + fresh.script[0].delay / m.speed };
}

export function togglePause(m, now) {
  if (m.paused) return { ...m, paused: false, nextAt: now + m.remaining };
  return { ...m, paused: true, remaining: Math.max(0, m.nextAt - now) };
}

// Runs a mission instantly, for seeding the dashboard with history.
export function runInstantly(goal, { createdAt, stopAtApproval = false, decision = 'approve' } = {}) {
  let m = createMission(goal, { createdAt });
  while (m.cursor < m.script.length) {
    const at = createdAt + m.clock;
    m = applyStep({ ...m, nextAt: at }, at);
    if (m.status === 'awaiting_approval') {
      if (stopAtApproval) return { ...m, updatedAt: at };
      const pending = m.approvals[m.approvals.length - 1];
      m = resolveApproval(m, pending.id, decision, null, at + 90_000);
      m = { ...m, clock: m.clock + 90_000 };
    }
  }
  const end = createdAt + m.clock;
  return { ...m, updatedAt: end, completedAt: end };
}


// ---------------------------------------------------------------------------
// Replay. Rebuilds a mission's state at mission-time `until` by running the
// same script again and applying the decisions the human actually made. There
// is no separate replay engine: it is the same applyStep/resolveApproval path.

const REPLAY_APPROVAL_HOLD = 2500; // how long a replay lingers on each approval

const DECISION = { approved: 'approve', edited: 'edit', rejected: 'reject' };

export function replayTo(m, until) {
  let r = { ...createMission(m.goal, { templateId: m.templateId, createdAt: m.createdAt, demo: m.demo, plan: m.plan }), id: m.id, runId: m.runId };
  while (r.cursor < r.script.length) {
    const step = r.script[r.cursor];
    if (step.approval) {
      r = applyStep(r, m.createdAt + r.clock);
      const asked = r.approvals[r.approvals.length - 1];
      const decided = m.approvals.find((a) => a.id === asked.id);
      if (!decided || decided.status === 'pending' || r.clock + REPLAY_APPROVAL_HOLD > until) break;
      const decision = DECISION[decided.status];
      r = { ...r, clock: r.clock + REPLAY_APPROVAL_HOLD };
      r = resolveApproval(r, asked.id, decision, decision === 'edit' ? decided.payload : null, decided.resolvedAt);
      continue;
    }
    if (r.clock + step.delay > until) break;
    r = applyStep(r, m.createdAt + r.clock + step.delay);
  }
  // Show the wall-clock times from the live run where they exist.
  const liveAt = Object.fromEntries(m.events.map((e) => [e.id, e.at]));
  const events = r.events.map((e) => (liveAt[e.id] ? { ...e, at: liveAt[e.id] } : e));
  const finished = r.cursor >= r.script.length;
  return { ...r, events, clock: finished ? r.clock : Math.max(r.clock, until) };
}

export function replayLength(m) {
  return replayTo(m, Infinity).clock;
}
