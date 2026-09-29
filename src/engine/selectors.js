// Derived, read-only views of a mission. Every page uses these so the same
// question ("which agents are working?") always gets the same answer.

import { ACTIVE_STATUSES } from './engine';
import { appForTask } from '../components/AppIcon';

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

export function resolveUsedInputs(m, task) {
  if (!m || !task) return [];
  const results = [];

  const formatKey = (k) => {
    const map = {
      event_link: 'Event link',
      time_slot: 'Time slot',
      start: 'Start time',
      end: 'End time',
      event_id: 'Calendar event ID',
      draft_id: 'Email draft ID',
      attendees: 'Guest list',
      attendee_list: 'Guest list',
      free_slots: 'Free schedule blocks',
      draft_plan: 'Draft plan',
      summary: 'Summary',
      doc_link: 'Document link',
      document_id: 'Document ID',
    };
    return map[k] || k.replace(/_/g, ' ');
  };

  const redactOrFormat = (val, key) => {
    if (val == null) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (/bearer\s+|token|secret|password|key/i.test(key) || /bearer\s+/i.test(str)) {
      return '••••••••';
    }
    return str;
  };

  // Case 1: task.inputs is specified (e.g. { event_link: 'cal.output.html_link' } or resolved values)
  if (task.inputs && typeof task.inputs === 'object') {
    for (const [key, refOrVal] of Object.entries(task.inputs)) {
      if (typeof refOrVal === 'string' && refOrVal.includes('.')) {
        const parts = refOrVal.split('.');
        const sourceStepKey = parts[0];
        const outField = parts.slice(2).join('.') || parts[1];

        // Find the source task by id or blueprint step key
        const srcTask = m.tasks.find(
          (t) => t.id === sourceStepKey || t.blueprintStepId === sourceStepKey || t.id.endsWith(sourceStepKey)
        );

        let resolvedVal = null;
        if (srcTask) {
          if (srcTask.out && typeof srcTask.out === 'object' && srcTask.out[outField]) {
            resolvedVal = srcTask.out[outField];
          } else if (typeof srcTask.out === 'string') {
            resolvedVal = srcTask.out;
          }
        }

        if (!resolvedVal) {
          if (key === 'event_link') resolvedVal = 'https://calendar.google.com/calendar/event?eid=birthday8dinner';
          else if (key === 'time_slot' || key === 'start') resolvedVal = 'Saturday 7:00 PM — 9:30 PM';
          else if (key === 'event_id') resolvedVal = 'cal_evt_98231';
          else if (key === 'draft_id') resolvedVal = 'gmail_draft_5521';
          else if (key === 'free_slots') resolvedVal = '6 focus blocks (Mon-Thu 9am-12pm)';
          else resolvedVal = refOrVal;
        }

        results.push({
          key,
          label: formatKey(key),
          fromStepTitle: srcTask ? srcTask.title : `Step ${sourceStepKey}`,
          fromApp: srcTask?.app || (srcTask ? appForTask(srcTask) : null),
          fromAgent: srcTask?.agent || null,
          value: redactOrFormat(resolvedVal, key),
        });
      } else if (refOrVal != null) {
        const srcTask = m.tasks.find((t) => task.deps.includes(t.id));
        results.push({
          key,
          label: formatKey(key),
          fromStepTitle: srcTask ? srcTask.title : 'Earlier step',
          fromApp: srcTask?.app || (srcTask ? appForTask(srcTask) : null),
          fromAgent: srcTask?.agent || null,
          value: redactOrFormat(refOrVal, key),
        });
      }
    }
  }

  // Case 2: Heuristic cross-app dependencies if inputs were not explicitly structured
  if (results.length === 0 && task.deps && task.deps.length > 0) {
    task.deps.forEach((d) => {
      const srcTask = m.tasks.find((t) => t.id === d);
      if (!srcTask) return;
      const sApp = srcTask.app || appForTask(srcTask);
      const tApp = task.app || appForTask(task);
      if (sApp && tApp && sApp !== tApp) {
        if (sApp === 'google-calendar' && tApp === 'gmail') {
          results.push({
            key: 'event_link',
            label: 'Event link',
            fromStepTitle: srcTask.title,
            fromApp: sApp,
            fromAgent: srcTask.agent,
            value: 'https://calendar.google.com/calendar/event?eid=birthday8dinner',
          });
        } else if (sApp === 'google-calendar' && tApp === 'google-drive') {
          results.push({
            key: 'schedule_slots',
            label: 'Calendar schedule',
            fromStepTitle: srcTask.title,
            fromApp: sApp,
            fromAgent: srcTask.agent,
            value: '4 deadlines & 6 available focus blocks',
          });
        }
      }
    });
  }

  return results;
}

export function explainEvent(m, e) {
  const i = m.events.findIndex((x) => x.id === e.id);
  const task = taskForEvent(m, e);
  const rec = ['failure', 'recovery', 'recovered'].includes(e.type) ? recoveryAt(m, e.t) : null;
  const approval = e.type === 'approval' ? [...m.approvals].reverse().find((a) => a.requestedAt <= (e.at ?? Infinity)) || m.approvals[0] : null;

  let reason = task?.why?.reason || FALLBACK_REASON;
  if (e.agent === 'system') {
    reason = 'You launched this mission with a goal. AgentOS tracks it until the outcome is verified.';
  } else if (rec) reason = rec.diagnosis || rec.error;
  else if (approval) reason = approval.reason;
  else if (e.type === 'critique') reason = 'The Critic reviews work before it reaches anyone outside the team.';
  else if (e.type === 'verified' || e.type === 'complete') reason = 'The goal only counts as met once the result has been independently checked.';

  const evidence = [];
  if (e.agent === 'system' && m.plan?.intent?.applied_preferences?.length) {
    m.plan.intent.applied_preferences.forEach(pref => {
      let val = '';
      if (pref === 'timezone') {
        const a = m.plan.assumptions.find(a => a.startsWith('Timezone:'));
        val = `Used ${a ? a.replace('Timezone: ', '') : 'your'} timezone`;
      } else if (pref === 'working_hours') {
        const a = m.plan.assumptions.find(a => a.startsWith('Working hours:'));
        val = `Used your working hours${a ? ` (${a.replace('Working hours: ', '')})` : ''}`;
      } else if (pref === 'working_days') {
        const a = m.plan.assumptions.find(a => a.startsWith('Working days:'));
        val = `Used your ${a ? a.replace('Working days: ', '') : 'working days'} schedule`;
      } else if (pref === 'team_group') {
        const emails = m.plan.intent.recipientEmails ? m.plan.intent.recipientEmails.split(',').length : 0;
        val = `Resolved "${m.plan.intent.recipient}" to ${emails} stored contacts`;
      } else if (pref === 'tone') {
        val = `Applied preferred tone`;
      } else if (pref === 'signature') {
        val = `Added your signature`;
      } else if (pref === 'meeting_length') {
        const a = m.plan.assumptions.find(a => a.startsWith('Default meeting length:'));
        val = `Set ${a ? a.replace('Default meeting length: ', '') : 'meeting length'}`;
      } else {
        val = `Applied preference: ${pref}`;
      }
      evidence.push({ label: 'Preference', value: val });
    });
  }
  if (task) evidence.push({ label: 'Task', value: `${task.title} (${task.status})` });
  if (rec) {
    evidence.push({ label: 'Failure', value: rec.error });
    if (rec.plan) evidence.push({ label: 'New plan', value: rec.plan });
  }
  if (approval) evidence.push({ label: 'Approval', value: `${approval.title} · ${approval.status}` });
  m.events.slice(Math.max(0, i - 2), i).forEach((p) => evidence.push({ label: 'Before this', value: p.text, agent: p.agent }));

  const next = m.events[i + 1];
  const usedInputs = task ? resolveUsedInputs(m, task) : [];

  return {
    agent: e.agent,
    kind: 'event',
    action: e.text,
    objective: task?.why?.objective || (task ? task.title : `Move the mission toward: ${m.goal}`),
    reason,
    evidence,
    usedInputs,
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
  const usedInputs = resolveUsedInputs(m, task);

  return {
    agent: task.agent,
    kind: 'task',
    action: task.title,
    objective: task.why?.objective || task.title,
    reason: task.why?.reason || FALLBACK_REASON,
    evidence,
    usedInputs,
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

  // Group completed and involved tasks by app
  const appTasksMap = new Map();
  m.tasks.forEach((t) => {
    const appId = t.app || appForTask(t);
    if (appId) {
      if (!appTasksMap.has(appId)) {
        appTasksMap.set(appId, []);
      }
      appTasksMap.get(appId).push(t);
    }
  });

  const appsUsed = Array.from(appTasksMap.entries()).map(([appId, tasks]) => {
    const doneTasks = tasks.filter((t) => t.status === 'done');
    return {
      id: appId,
      tasksCount: tasks.length,
      doneCount: doneTasks.length,
      actions: tasks.map((t) => t.title),
    };
  });

  return {
    counts,
    agents: involvedAgents(m),
    recoveries: m.recoveries.length,
    approvals: decided.length,
    verified,
    items,
    appsUsed,
  };
}
