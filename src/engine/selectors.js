// Derived, read-only views of a mission. Every page uses these so the same
// question ("which agents are working?") always gets the same answer.

import { ACTIVE_STATUSES } from './engine';

export function taskCounts(m) {
  const counted = m.tasks.filter((t) => t.status !== 'skipped');
  const done = counted.filter((t) => t.status === 'done').length;
  return { total: counted.length, done, remaining: counted.length - done };
}

export function isLive(m) {
  return ACTIVE_STATUSES.includes(m.status) && !m.paused;
}

// Agents doing something right now: owners of running tasks, whoever spoke in
// the last few events, and the agent the current status belongs to.
export function activeAgents(m) {
  const working = new Set();
  if (!m || !ACTIVE_STATUSES.includes(m.status)) return working;
  // While the mission waits on a human, only the Approval agent is doing anything.
  if (m.status === 'awaiting_approval') return new Set(['approval']);
  m.events.slice(-3).forEach((e) => e.agent !== 'system' && working.add(e.agent));
  m.tasks.filter((t) => t.status === 'running').forEach((t) => working.add(t.agent));
  if (m.status === 'planning') working.add('planner');
  if (m.status === 'recovering') working.add('recovery');
  return working;
}

// Agents that took part at any point in the mission.
export function involvedAgents(m) {
  return [...new Set([...m.events.map((e) => e.agent), ...m.tasks.map((t) => t.agent)])].filter((a) => a !== 'system');
}

export function currentTasks(m) {
  return m.tasks.filter((t) => t.status === 'running' || t.status === 'awaiting' || t.status === 'failed');
}

export function activeRecovery(m) {
  return m.recoveries.find((r) => r.status !== 'resolved') || null;
}

// One sentence describing what AgentOS is doing right now.
export function currentObjective(m) {
  if (m.status === 'completed') return 'Mission complete. The outcome has been verified.';
  const pending = m.approvals.find((a) => a.status === 'pending');
  if (pending) return `Waiting for your approval: ${pending.title}`;
  const rec = activeRecovery(m);
  if (rec) {
    const stage = {
      diagnosing: 'Diagnosing why',
      replanning: 'Building an alternative after',
      retrying: 'Retrying with a new approach after',
    }[rec.status];
    return `${stage || 'Recovering from'} “${rec.task}” failed`;
  }
  if (m.status === 'planning') return 'Turning the goal into a plan';
  const running = m.tasks.filter((t) => t.status === 'running');
  if (running.length) return running.map((t) => t.title).join(' · ');
  return 'Handing off to the next task';
}

export function approvalState(m) {
  if (m.approvals.some((a) => a.status === 'pending')) return { label: 'Waiting on you', tone: 'text-amber-300' };
  const last = m.approvals[m.approvals.length - 1];
  if (!last) {
    const gated = m.tasks.some((t) => t.gated);
    return gated ? { label: 'Checkpoint ahead', tone: 'text-gray-300' } : { label: 'None needed', tone: 'text-gray-400' };
  }
  if (last.status === 'rejected') return { label: 'Rejected', tone: 'text-red-300' };
  if (last.status === 'edited') return { label: 'Approved, edited', tone: 'text-emerald-300' };
  return { label: 'Approved', tone: 'text-emerald-300' };
}

export function taskDuration(t, clock) {
  if (t.startedAt == null) return null;
  const end = t.finishedAt ?? clock;
  return Math.max(0, end - t.startedAt);
}

// The task an event belongs to: the one its agent was working on at that
// moment, else any task in flight, else none.
export function taskForEvent(m, e) {
  const inFlight = (t) => t.startedAt != null && t.startedAt <= e.t && (t.finishedAt == null || t.finishedAt >= e.t);
  return m.tasks.find((t) => t.agent === e.agent && inFlight(t)) || m.tasks.find(inFlight) || null;
}

// ---------------------------------------------------------------------------
// Explainability. Every field comes from mission state or from the scripted
// `why` on a task; nothing here is generated.

const FALLBACK_REASON = 'Part of the plan the Planner built for this goal.';

function recoveryAt(m, t) {
  return [...m.recoveries].reverse().find((r) => r.startedAt <= t) || null;
}

export function explainEvent(m, e) {
  const i = m.events.findIndex((x) => x.id === e.id);
  const task = taskForEvent(m, e);
  const rec = ['failure', 'recovery', 'recovered'].includes(e.type) ? recoveryAt(m, e.t) : null;
  const approval = e.type === 'approval' ? [...m.approvals].reverse().find((a) => a.requestedAt <= (e.at ?? Infinity)) || m.approvals[0] : null;

  let reason = task?.why?.reason || FALLBACK_REASON;
  if (e.agent === 'system') reason = 'You launched this mission with a goal. AgentOS tracks it until the outcome is verified.';
  else if (rec) reason = rec.diagnosis || rec.error;
  else if (approval) reason = approval.reason;
  else if (e.type === 'critique') reason = 'The Critic reviews work before it reaches anyone outside the team.';
  else if (e.type === 'verified' || e.type === 'complete') reason = 'The goal only counts as met once the result has been independently checked.';

  const evidence = [];
  if (task) evidence.push({ label: 'Task', value: `${task.title} (${task.status})` });
  if (rec) {
    evidence.push({ label: 'Failure', value: rec.error });
    if (rec.plan) evidence.push({ label: 'New plan', value: rec.plan });
  }
  if (approval) evidence.push({ label: 'Approval', value: `${approval.title} · ${approval.status}` });
  m.events.slice(Math.max(0, i - 2), i).forEach((p) => evidence.push({ label: 'Before this', value: p.text, agent: p.agent }));

  const next = m.events[i + 1];
  return {
    agent: e.agent,
    kind: 'event',
    action: e.text,
    objective: task?.why?.objective || (task ? task.title : `Move the mission toward: ${m.goal}`),
    reason,
    evidence,
    next: next ? { agent: next.agent, text: next.text } : null,
    at: e.at,
    t: e.t,
  };
}

export function explainTask(m, task) {
  const related = m.events.filter((e) => taskForEvent(m, e)?.id === task.id).slice(-3);
  const deps = task.deps.map((d) => m.tasks.find((t) => t.id === d)).filter(Boolean);
  const unlocks = m.tasks.filter((t) => t.deps.includes(task.id));
  const duration = taskDuration(task, m.clock);
  const evidence = [
    { label: 'Status', value: task.status + (duration != null ? ` · ${Math.round(duration / 1000)}s` : '') },
    ...(deps.length ? [{ label: 'Waited for', value: deps.map((d) => d.title).join(', ') }] : []),
    ...(task.gated ? [{ label: 'Checkpoint', value: 'Needs human approval before it runs' }] : []),
    ...related.map((e) => ({ label: 'Log', value: e.text, agent: e.agent })),
  ];
  return {
    agent: task.agent,
    kind: 'task',
    action: task.title,
    objective: task.why?.objective || task.title,
    reason: task.why?.reason || FALLBACK_REASON,
    evidence,
    next: unlocks.length ? { agent: unlocks[0].agent, text: unlocks.map((t) => t.title).join(' · ') } : null,
    t: task.startedAt,
  };
}

// ---------------------------------------------------------------------------
// Outcome report for a finished mission.

export function missionSummary(m) {
  const counts = taskCounts(m);
  const decided = m.approvals.filter((a) => a.status !== 'pending');
  const verifiers = m.tasks.filter((t) => t.agent === 'verification');
  const verified = verifiers.length > 0 && verifiers.every((t) => t.status === 'done') && m.events.some((e) => e.type === 'verified');
  const gated = m.tasks.find((t) => t.gated);

  const items = [
    ...m.tasks
      .filter((t) => t.status === 'done')
      .map((t) => ({ t: t.finishedAt ?? 0, kind: 'task', agent: t.agent, text: t.title })),
    ...m.recoveries
      .filter((r) => r.status === 'resolved')
      .map((r) => ({ t: (r.resolvedAt ?? r.startedAt) - 0.5, kind: 'recovery', agent: 'recovery', text: `Recovered from a failure: ${r.error}` })),
    ...decided.map((a) => ({
      t: (gated?.startedAt ?? gated?.finishedAt ?? 0) - 1,
      kind: 'approval',
      agent: 'approval',
      text:
        a.status === 'rejected'
          ? `Respected your rejection: ${a.title}`
          : a.status === 'edited'
          ? `Obtained your approval, with your edits: ${a.title}`
          : `Obtained your approval: ${a.title}`,
    })),
  ].sort((a, b) => a.t - b.t);

  return {
    counts,
    agents: involvedAgents(m),
    recoveries: m.recoveries.length,
    approvals: decided.length,
    verified,
    items,
  };
}
