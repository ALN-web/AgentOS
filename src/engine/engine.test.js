import { describe, expect, it } from 'vitest';
import { advance, createMission, replayTo, resolveApproval, restartMission, setSpeed, togglePause } from './engine';
import { missionSummary } from './selectors';

const HERO = 'Get 100 registrations for our college hackathon';
const T0 = 1_700_000_000_000;

// Advance simulated time step by step until `stop(m)` or the mission halts.
function runUntil(m, stop = () => false, limit = 500) {
  let now = m.nextAt;
  for (let i = 0; i < limit; i++) {
    if (stop(m) || m.status === 'completed' || m.status === 'awaiting_approval' || m.paused) return { m, now };
    now = Math.max(now, m.nextAt);
    m = advance(m, now);
  }
  throw new Error('mission did not settle');
}

function toApproval() {
  const { m, now } = runUntil(createMission(HERO, { createdAt: T0, demo: true }));
  return { m, now, approval: m.approvals.find((a) => a.status === 'pending') };
}

function finish(decision, edits) {
  const { m, now, approval } = toApproval();
  const decided = resolveApproval(m, approval.id, decision, edits, now + 5000);
  return runUntil(decided).m;
}

const texts = (m) => m.events.map((e) => e.text);

describe('mission creation', () => {
  it('starts in planning with an empty, serialisable state', () => {
    const m = createMission(HERO, { createdAt: T0, demo: true });
    expect(m.status).toBe('planning');
    expect(m.demo).toBe(true);
    expect(m.tasks).toEqual([]);
    expect(m.events).toEqual([]);
    expect(m.cursor).toBe(0);
    expect(m.nextAt).toBeGreaterThan(T0);
  });

  it('gives every mission and run a unique id', () => {
    const a = createMission(HERO, { createdAt: T0 });
    const b = createMission(HERO, { createdAt: T0 });
    expect(a.id).not.toBe(b.id);
    expect(a.runId).not.toBe(b.runId);
  });
});

describe('normal execution', () => {
  it('plans 7 tasks and stops at the approval gate', () => {
    const { m, approval } = toApproval();
    expect(m.status).toBe('awaiting_approval');
    expect(m.tasks).toHaveLength(7);
    expect(m.tasks.find((t) => t.id === 't5').status).toBe('awaiting');
    expect(approval.payload.recipients).toBe(480);
  });

  it('does not move past a pending approval however much time passes', () => {
    const { m, now } = toApproval();
    const later = advance(m, now + 10 * 60_000);
    expect(later).toBe(m);
  });

  it('is pure: advancing the same state twice gives the same result', () => {
    const m = createMission(HERO, { createdAt: T0 });
    const at = m.nextAt + 5000;
    expect(advance(m, at)).toEqual(advance(m, at));
  });
});

describe('approval branches', () => {
  it('approve: sends to 480, recovers, verifies and completes at 104/100', () => {
    const m = finish('approve');
    expect(m.status).toBe('completed');
    expect(m.completedAt).not.toBeNull();
    expect(m.metric.current).toBe(104);
    expect(texts(m)).toContain('480 of 480 delivered. 3 bounced.');
    expect(missionSummary(m).verified).toBe(true);
    expect(m.approvals[0].status).toBe('approved');
  });

  it('edit: the edited recipient count drives every later action', () => {
    const m = finish('edit', { recipients: 320 });
    expect(m.status).toBe('completed');
    expect(m.approvals[0].status).toBe('edited');
    expect(m.approvals[0].original.recipients).toBe(480);
    expect(m.approvals[0].payload.recipients).toBe(320);
    expect(texts(m)).toContain('320 of 320 delivered. 2 bounced.');
    expect(texts(m).some((t) => t.includes('480 of 480'))).toBe(false);
    expect(m.tasks.find((t) => t.id === 't5').title).toBe('Email 320 past attendees');
  });

  it('reject: no email is sent, the plan routes around it and still completes', () => {
    const m = finish('reject');
    expect(m.status).toBe('completed');
    expect(m.approvals[0].status).toBe('rejected');
    expect(m.tasks.find((t) => t.id === 't5').status).toBe('skipped');
    expect(m.tasks.find((t) => t.id === 't5b').status).toBe('done');
    expect(texts(m).some((t) => /delivered/.test(t))).toBe(false);
    expect(missionSummary(m).verified).toBe(true);
  });

  it('ignores a second decision on the same approval', () => {
    const { m, now, approval } = toApproval();
    const once = resolveApproval(m, approval.id, 'approve', null, now);
    const twice = resolveApproval(once, approval.id, 'reject', null, now);
    expect(twice).toBe(once);
  });
});

describe('failure recovery', () => {
  it('fails, diagnoses, re-plans, resumes and recovers in that order', () => {
    const m = finish('approve');
    const [r] = m.recoveries;
    expect(m.recoveries).toHaveLength(1);
    expect(r.status).toBe('resolved');
    expect(r.startedAt).toBeLessThanOrEqual(r.diagnosingAt);
    expect(r.diagnosingAt).toBeLessThan(r.replanningAt);
    expect(r.replanningAt).toBeLessThan(r.retryingAt);
    expect(r.retryingAt).toBeLessThan(r.resolvedAt);

    const idx = (pred) => m.events.findIndex(pred);
    const failure = idx((e) => e.type === 'failure' && e.agent === 'browser');
    const firstRecovery = idx((e) => e.agent === 'recovery');
    const planUpdate = idx((e) => e.agent === 'planner' && e.text.startsWith('Plan updated'));
    const recovered = idx((e) => e.type === 'recovered');
    expect(failure).toBeGreaterThan(-1);
    expect(firstRecovery).toBeGreaterThan(failure);
    expect(planUpdate).toBeGreaterThan(firstRecovery);
    expect(recovered).toBeGreaterThan(planUpdate);
  });

  it('does not start recovery before the failure happens', () => {
    const { m } = toApproval();
    expect(m.recoveries).toHaveLength(0);
    expect(m.events.some((e) => e.agent === 'recovery')).toBe(false);
  });
});

describe('completion', () => {
  it('stays put once complete', () => {
    const m = finish('approve');
    expect(advance(m, m.updatedAt + 60_000)).toBe(m);
  });
});

describe('pause, resume and speed', () => {
  it('pausing freezes the mission and resuming continues it', () => {
    let m = createMission(HERO, { createdAt: T0 });
    m = advance(m, m.nextAt);
    const paused = togglePause(m, m.updatedAt);
    expect(advance(paused, paused.updatedAt + 60_000)).toBe(paused);
    const resumed = togglePause(paused, paused.updatedAt + 60_000);
    expect(resumed.paused).toBe(false);
    const next = advance(resumed, resumed.nextAt);
    expect(next.events.length).toBeGreaterThan(paused.events.length);
  });

  it('changing speed while paused keeps the remaining time', () => {
    let m = createMission(HERO, { createdAt: T0 });
    const paused = togglePause(m, T0 + 100);
    const fast = setSpeed(paused, 4, T0 + 5000);
    expect(fast.remaining).toBeCloseTo(paused.remaining / 4);
    const resumed = togglePause(fast, T0 + 6000);
    expect(resumed.nextAt).toBe(T0 + 6000 + fast.remaining);
  });
});

describe('restart', () => {
  it('returns to the initial state with the same id and fresh run ids', () => {
    const done = finish('reject');
    const again = restartMission(done, T0 + 999_999);
    expect(again.id).toBe(done.id);
    expect(again.runId).not.toBe(done.runId);
    expect(again.status).toBe('planning');
    expect(again.events).toEqual([]);
    expect(again.approvals).toEqual([]);
    expect(again.recoveries).toEqual([]);
    expect(again.metric.current).toBe(0);
    expect(again.demo).toBe(true);

    // The earlier rejection does not leak into the new run.
    const { m } = runUntil(again);
    const pending = m.approvals.find((a) => a.status === 'pending');
    expect(pending).toBeDefined();
    expect(done.approvals.some((a) => a.id === pending.id)).toBe(false);
  });
});

describe('replay', () => {
  it('reproduces the finished mission, including an edited approval', () => {
    const m = finish('edit', { recipients: 320 });
    const r = replayTo(m, Infinity);
    expect(r.status).toBe('completed');
    expect(r.metric.current).toBe(m.metric.current);
    expect(texts(r)).toEqual(texts(m));
    expect(r.events.map((e) => e.id)).toEqual(m.events.map((e) => e.id));
  });

  it('shows the mission as it was at an earlier moment', () => {
    const m = finish('approve');
    const r = replayTo(m, 5000);
    expect(r.status).not.toBe('completed');
    expect(r.events.length).toBeLessThan(m.events.length);
  });
});

describe('generic missions', () => {
  it('any other goal also plans, pauses for approval, recovers and completes', () => {
    const start = createMission('Find 3 quotes for office chairs', { createdAt: T0 });
    const { m, now } = runUntil(start);
    expect(m.status).toBe('awaiting_approval');
    const done = runUntil(resolveApproval(m, m.approvals[0].id, 'approve', null, now)).m;
    expect(done.status).toBe('completed');
    expect(done.recoveries[0].status).toBe('resolved');
  });
});
