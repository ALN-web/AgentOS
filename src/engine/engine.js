// Client-side mission engine.
//
// Each mission carries a `script`: an ordered list of steps. A step is either
//   { delay, run(mission) => mission }                   — a pure state update, or
//   { delay, approval, approve(edited) => steps, reject() => steps }  — a pause for a human.
// The provider calls `advance` on a timer; approval branches are spliced into the
// script when the user decides. All functions here are pure so React can call
// them freely (StrictMode double-invocation included).

import { buildScript } from './scenarios';

let seq = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const ACTIVE_STATUSES = ['planning', 'running', 'awaiting_approval', 'recovering'];

export function createMission(goal, { templateId = null, createdAt = Date.now() } = {}) {
  const { script, metric } = buildScript(goal);
  return {
    id: uid('m'),
    goal,
    templateId,
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
      id: `${m.id}_a${m.cursor}`,
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
  const branch = decision === 'reject' ? step.reject() : step.approve(edited);
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
          payload: edited ? { ...a.payload, ...edits } : a.payload,
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
  const left = Math.max(0, m.nextAt - now) * (m.speed / speed);
  return { ...m, speed, nextAt: now + left };
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

