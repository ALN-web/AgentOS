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
  m.events.slice(-3).forEach((e) => e.agent !== 'system' && working.add(e.agent));
  m.tasks.filter((t) => t.status === 'running').forEach((t) => working.add(t.agent));
  if (m.status === 'planning') working.add('planner');
  if (m.status === 'recovering') working.add('recovery');
  if (m.status === 'awaiting_approval') working.add('approval');
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
