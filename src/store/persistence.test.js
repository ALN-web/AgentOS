import { describe, expect, it } from 'vitest';
import { advance, createMission, resolveApproval } from '../engine/engine';
import { SCHEMA_VERSION, deserialize, loadMissions, serialize } from './persistence';

const HERO = 'Get 100 registrations for our college hackathon';
const T0 = 1_700_000_000_000;

function runUntil(m, stop = () => false) {
  let now = m.nextAt;
  for (let i = 0; i < 500; i++) {
    if (stop(m) || m.status === 'completed' || m.status === 'awaiting_approval') return { m, now };
    now = Math.max(now, m.nextAt);
    m = advance(m, now);
  }
  throw new Error('mission did not settle');
}

const roundTrip = (missions, savedAt, now) => deserialize(serialize(missions, savedAt), now);
const texts = (m) => m.events.map((e) => e.text);

describe('serialisation', () => {
  it('never stores the executable script', () => {
    const m = createMission(HERO, { createdAt: T0 });
    const json = serialize([m], T0);
    expect(JSON.parse(json).missions[0].script).toBeUndefined();
    expect(JSON.parse(json).version).toBe(SCHEMA_VERSION);
  });
});

describe('restoring saved missions', () => {
  it('restores a pending approval as pending, and it still controls the mission', () => {
    const { m: waiting, now } = runUntil(createMission(HERO, { createdAt: T0 }));
    const [restored] = roundTrip([waiting], now, now + 3_600_000);

    expect(restored.status).toBe('awaiting_approval');
    expect(restored.approvals[0].status).toBe('pending');
    // A reload never approves anything by itself.
    expect(advance(restored, now + 7_200_000)).toBe(restored);

    const later = now + 3_600_000;
    const done = runUntil(resolveApproval(restored, restored.approvals[0].id, 'edit', { recipients: 320 }, later)).m;
    expect(done.status).toBe('completed');
    expect(texts(done).some((t) => t.includes('320 of 320 invites'))).toBe(true);
  });

  it('continues a mission saved after an edited approval exactly as if never reloaded', () => {
    const { m: waiting, now } = runUntil(createMission(HERO, { createdAt: T0 }));
    const decided = resolveApproval(waiting, waiting.approvals[0].id, 'edit', { recipients: 320 }, now);
    const { m: midway, now: t } = runUntil(decided, (m) => m.status === 'recovering');

    const uninterrupted = runUntil(midway).m;
    const [restored] = roundTrip([midway], t, t + 10_000);
    const resumed = runUntil(restored).m;

    expect(resumed.status).toBe('completed');
    expect(texts(resumed)).toEqual(texts(uninterrupted));
    expect(resumed.metric.current).toBe(uninterrupted.metric.current);
  });

  it('restores a rejected, completed mission', () => {
    const { m: waiting, now } = runUntil(createMission(HERO, { createdAt: T0 }));
    const done = runUntil(resolveApproval(waiting, waiting.approvals[0].id, 'reject', null, now)).m;
    const [restored] = roundTrip([done], now, now + 1000);
    expect(restored.status).toBe('completed');
    expect(restored.cursor).toBe(restored.script.length);
    expect(advance(restored, now + 99_999)).toBe(restored);
  });

  it('resumes the step timer from now, not from when the tab was closed', () => {
    const m = createMission(HERO, { createdAt: T0 });
    const wait = m.nextAt - T0;
    const [restored] = roundTrip([m], T0, T0 + 86_400_000);
    expect(restored.nextAt).toBe(T0 + 86_400_000 + wait);
  });
});

describe('invalid stored data', () => {
  const good = () => createMission(HERO, { createdAt: T0 });

  it('rejects unparseable JSON', () => {
    expect(deserialize('{not json', T0)).toBeNull();
  });

  it('rejects other schema versions', () => {
    const data = JSON.parse(serialize([good()], T0));
    data.version = 999;
    expect(deserialize(JSON.stringify(data), T0)).toBeNull();
  });

  it('drops tampered missions and keeps valid ones', () => {
    const valid = good();
    const data = JSON.parse(serialize([valid, good(), good(), good(), good()], T0));
    data.missions[1].status = 'exploded';
    data.missions[2].cursor = 9999;
    data.missions[3].sig = 'from-an-older-script';
    data.missions[4].events = 'nope';
    const restored = deserialize(JSON.stringify(data), T0);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(valid.id);
  });

  it('drops a mission whose pending approval no longer matches its position', () => {
    const { m: waiting, now } = runUntil(createMission(HERO, { createdAt: T0 }));
    const data = JSON.parse(serialize([waiting], now));
    data.missions[0].cursor -= 1;
    expect(deserialize(JSON.stringify(data), now)).toBeNull();
  });

  it('returns null when nothing survives', () => {
    expect(deserialize(JSON.stringify({ version: SCHEMA_VERSION, savedAt: T0, missions: [{ id: 1 }] }), T0)).toBeNull();
  });

  it('works without browser storage', () => {
    expect(loadMissions(T0)).toBeNull();
  });
});
