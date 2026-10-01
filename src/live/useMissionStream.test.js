import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  applyMissionEvent,
  missionEventReducer,
  formatEventText,
  mapEventType,
  backendEventToUi,
} from './useMissionStream';

describe('useMissionStream event reduction & ops integration', () => {
  const baseMission = {
    id: 'm-live-1',
    goal: 'Host a dinner party',
    status: 'planned',
    createdAt: 1700000000000,
    clock: 0,
    tasks: [
      { id: 'p1', key: 'p1', title: 'Find slot', status: 'pending', deps: [], agent: 'planner' },
      { id: 'p2', key: 'p2', title: 'Send invites', status: 'pending', deps: ['p1'], agent: 'execution' },
    ],
    events: [],
    approvals: [],
    recoveries: [],
    checks: [],
    metric: { auto: true, current: 0, target: 2, label: 'tasks done' },
  };

  it('transitions mission through lifecycle events using ops', () => {
    // 1. MISSION_STARTED
    const started = applyMissionEvent(baseMission, {
      seq: 1,
      type: 'MISSION_STARTED',
      agent: 'planner',
      created_at: new Date(baseMission.createdAt + 1000).toISOString(),
    });
    expect(started.status).toBe('running');
    expect(started.events).toHaveLength(1);
    expect(started.events[0].seq).toBe(1);

    // 2. AGENT_ASSIGNED
    const assigned = applyMissionEvent(started, {
      seq: 2,
      type: 'AGENT_ASSIGNED',
      agent: 'calendar_agent',
      payload: { task_key: 'p1', agent: 'calendar_agent' },
      created_at: new Date(baseMission.createdAt + 2000).toISOString(),
    });
    expect(assigned.tasks.find((t) => t.id === 'p1').agent).toBe('calendar_agent');

    // 3. TASK_STARTED
    const taskRunning = applyMissionEvent(assigned, {
      seq: 3,
      type: 'TASK_STARTED',
      agent: 'calendar_agent',
      payload: { task_key: 'p1' },
      created_at: new Date(baseMission.createdAt + 3000).toISOString(),
    });
    expect(taskRunning.tasks.find((t) => t.id === 'p1').status).toBe('running');

    // 4. TOOL_COMPLETED
    const taskDone = applyMissionEvent(taskRunning, {
      seq: 4,
      type: 'TOOL_COMPLETED',
      agent: 'calendar_agent',
      payload: {
        task_key: 'p1',
        tool: 'calendar.create_event',
        output: { summary: 'Dinner party' },
        evidence: [{ url: 'https://cal.google.com/event' }],
      },
      created_at: new Date(baseMission.createdAt + 4000).toISOString(),
    });
    expect(taskDone.tasks.find((t) => t.id === 'p1').status).toBe('done');
    expect(taskDone.metric.current).toBe(1);

    // 5. APPROVAL_REQUESTED
    const awaitingAppr = applyMissionEvent(taskDone, {
      seq: 5,
      type: 'APPROVAL_REQUESTED',
      agent: 'approval',
      payload: {
        approval_id: 'appr-99',
        task_key: 'p2',
        reason: 'Send invitations to 8 recipients',
        risk: 'HIGH',
      },
      created_at: new Date(baseMission.createdAt + 5000).toISOString(),
    });
    expect(awaitingAppr.status).toBe('awaiting_approval');
    expect(awaitingAppr.tasks.find((t) => t.id === 'p2').status).toBe('awaiting');
    expect(awaitingAppr.approvals).toHaveLength(1);
    expect(awaitingAppr.approvals[0].id).toBe('appr-99');

    // 6. APPROVAL_GRANTED
    const apprGranted = applyMissionEvent(awaitingAppr, {
      seq: 6,
      type: 'APPROVAL_GRANTED',
      agent: 'approval',
      payload: { approval_id: 'appr-99', edited: true },
      created_at: new Date(baseMission.createdAt + 6000).toISOString(),
    });
    expect(apprGranted.approvals[0].status).toBe('edited');

    // 7. TASK_STARTED for p2
    const p2Running = applyMissionEvent(apprGranted, {
      seq: 7,
      type: 'TASK_STARTED',
      agent: 'execution',
      payload: { task_key: 'p2' },
      created_at: new Date(baseMission.createdAt + 7000).toISOString(),
    });
    expect(p2Running.tasks.find((t) => t.id === 'p2').status).toBe('running');

    // 8. TOOL_COMPLETED for p2
    const p2Done = applyMissionEvent(p2Running, {
      seq: 8,
      type: 'TOOL_COMPLETED',
      agent: 'execution',
      payload: {
        task_key: 'p2',
        tool: 'gmail.send_draft',
        output: { to: 'friends' },
      },
      created_at: new Date(baseMission.createdAt + 8000).toISOString(),
    });
    expect(p2Done.tasks.find((t) => t.id === 'p2').status).toBe('done');
    expect(p2Done.metric.current).toBe(2);

    // 9. VERIFICATION_COMPLETED
    const verified = applyMissionEvent(p2Done, {
      seq: 9,
      type: 'VERIFICATION_COMPLETED',
      agent: 'verification',
      payload: { criteria: [{ label: 'Dinner event confirmed', passed: true }] },
      created_at: new Date(baseMission.createdAt + 9000).toISOString(),
    });
    expect(verified.checks).toHaveLength(1);
    expect(verified.checks[0]).toEqual({ label: 'Dinner event confirmed', status: 'done' });

    // 10. MISSION_COMPLETED
    const completed = applyMissionEvent(verified, {
      seq: 10,
      type: 'MISSION_COMPLETED',
      agent: 'planner',
      created_at: new Date(baseMission.createdAt + 10000).toISOString(),
    });
    expect(completed.status).toBe('completed');
    expect(completed.events).toHaveLength(10);
  });

  it('rejects duplicate events and maintains monotonic order', () => {
    let state = baseMission;
    state = missionEventReducer(state, {
      type: 'EVENT',
      event: { seq: 1, type: 'MISSION_STARTED', agent: 'planner' },
    });
    expect(state.events).toHaveLength(1);

    // Attempting to apply the exact same event seq 1 again is a no-op
    const duplicateState = missionEventReducer(state, {
      type: 'EVENT',
      event: { seq: 1, type: 'MISSION_STARTED', agent: 'planner' },
    });
    expect(duplicateState).toBe(state);
    expect(duplicateState.events).toHaveLength(1);

    // Event 3 arrives, then Event 2 arrives out-of-order: reducer keeps them sorted by seq
    state = missionEventReducer(state, {
      type: 'EVENT',
      event: { seq: 3, type: 'TASK_STARTED', payload: { task_key: 'p1' } },
    });
    state = missionEventReducer(state, {
      type: 'EVENT',
      event: { seq: 2, type: 'AGENT_ASSIGNED', payload: { task_key: 'p1', agent: 'planner' } },
    });

    expect(state.events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('handles recovery and task replacement', () => {
    let state = baseMission;
    state = applyMissionEvent(state, {
      seq: 1,
      type: 'RECOVERY_STARTED',
      agent: 'recovery',
      payload: { recovery_id: 'rec-1', strategy: 're-attempting with relaxed time slot' },
    });
    expect(state.status).toBe('recovering');
    expect(state.recoveries).toHaveLength(1);
    expect(state.recoveries[0].id).toBe('rec-1');

    state = applyMissionEvent(state, {
      seq: 2,
      type: 'PLAN_UPDATED',
      agent: 'planner',
      payload: {
        replaced_task_key: 'p1',
        replacement_task: { id: 'p1_alt', title: 'Find alternate slot', deps: [] },
      },
    });
    const replaced = state.tasks.find((t) => t.id === 'p1');
    const replacement = state.tasks.find((t) => t.id === 'p1_alt');
    expect(replaced.status).toBe('skipped');
    expect(replacement).toBeDefined();
    // Dependency of p2 updated to p1_alt
    expect(state.tasks.find((t) => t.id === 'p2').deps).toContain('p1_alt');
  });

  it('handles approval rejection by dropping dependencies', () => {
    let state = baseMission;
    state = applyMissionEvent(state, {
      seq: 1,
      type: 'APPROVAL_REQUESTED',
      payload: { approval_id: 'appr-1', task_key: 'p1' },
    });
    state = applyMissionEvent(state, {
      seq: 2,
      type: 'APPROVAL_REJECTED',
      payload: { approval_id: 'appr-1', task_key: 'p1' },
    });
    expect(state.approvals[0].status).toBe('rejected');
    // p2 depended on p1, but dropDep removed it
    expect(state.tasks.find((t) => t.id === 'p2').deps).not.toContain('p1');
  });
});
