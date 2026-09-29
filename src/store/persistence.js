// Refresh-safe storage for missions.
//
// Only plain data is stored. A mission's script (which contains functions) is
// never saved: on load it is rebuilt from the goal, which selects the scenario,
// and the recorded approval decisions are spliced back in exactly as the
// engine did live. Anything that fails validation is dropped rather than
// trusted, and if storage is unavailable the app simply runs in memory.

import { buildScript } from '../engine/scenarios';

export const STORAGE_KEY = 'agentos.demo';
export const SCHEMA_VERSION = 1;

const STATUSES = ['planning', 'running', 'awaiting_approval', 'recovering', 'completed'];
const DECIDED = ['approved', 'edited', 'rejected'];

let cached;
function store() {
  if (cached !== undefined) return cached;
  try {
    const s = window.localStorage;
    const probe = '__agentos_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    cached = s;
  } catch {
    cached = null; // private mode, blocked storage, or no window
  }
  return cached;
}

// A fingerprint of a scenario's base script, so state saved against an older
// version of the script is discarded instead of replayed against the wrong steps.
const signatures = new Map();
export function scriptSignature(goal) {
  if (!signatures.has(goal)) {
    const { script } = buildScript(goal);
    signatures.set(goal, `${script.length}:${script.map((s) => (s.approval ? 'A' : s.delay)).join('.')}`);
  }
  return signatures.get(goal);
}

export function rebuildScript(m) {
  let { script } = buildScript(m.goal);
  const decided = m.approvals.filter((a) => a.status !== 'pending').sort((a, b) => a.stepIndex - b.stepIndex);
  for (const a of decided) {
    const step = script[a.stepIndex];
    if (!step || !step.approval) throw new Error('approval does not match the script');
    const branch =
      a.status === 'rejected' ? step.reject() : step.approve({ edited: a.status === 'edited', payload: a.payload });
    script = [...script.slice(0, a.stepIndex + 1), ...branch, ...script.slice(a.stepIndex + 1)];
  }
  return script;
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isStr = (x) => typeof x === 'string' && x.length > 0;

function looksValid(m) {
  return (
    m &&
    typeof m === 'object' &&
    isStr(m.id) &&
    isStr(m.runId) &&
    isStr(m.goal) &&
    STATUSES.includes(m.status) &&
    ['tasks', 'events', 'approvals', 'recoveries', 'checks'].every((k) => Array.isArray(m[k])) &&
    m.metric &&
    isNum(m.metric.current) &&
    isNum(m.metric.target) &&
    m.browser &&
    Array.isArray(m.browser.steps) &&
    Number.isInteger(m.cursor) &&
    m.cursor >= 0 &&
    [m.clock, m.createdAt, m.updatedAt, m.nextAt, m.speed, m.remaining].every(isNum) &&
    m.speed > 0 &&
    m.approvals.every((a) => isStr(a.id) && Number.isInteger(a.stepIndex) && (a.status === 'pending' || DECIDED.includes(a.status)) && a.payload) &&
    m.events.every((e) => isStr(e.id) && typeof e.text === 'string' && isNum(e.t))
  );
}

export function serialize(missions, now) {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    savedAt: now,
    missions: missions.map(({ script, ...m }) => ({ ...m, sig: scriptSignature(m.goal) })),
  });
}

// Returns restored missions, or null when there is nothing usable.
export function deserialize(raw, now) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || data.version !== SCHEMA_VERSION || !Array.isArray(data.missions) || !isNum(data.savedAt)) return null;

  const restored = [];
  for (const saved of data.missions) {
    try {
      if (!looksValid(saved) || saved.sig !== scriptSignature(saved.goal)) continue;
      const script = rebuildScript(saved);
      if (saved.cursor > script.length) continue;
      const pending = saved.approvals.filter((a) => a.status === 'pending');
      // A pending approval must still be pending, and must sit exactly where
      // the mission stopped. It is never resolved by a reload.
      if (pending.length > 1) continue;
      if ((pending.length === 1) !== (saved.status === 'awaiting_approval')) continue;
      if (pending.length === 1 && (pending[0].stepIndex !== saved.cursor || !script[saved.cursor]?.approval)) continue;
      if (saved.status === 'completed' && saved.cursor !== script.length) continue;

      const { sig, ...m } = saved;
      // Pick up where the mission left off: the wait before its next step
      // continues from now rather than from when the tab was closed.
      const wait = Math.max(0, Math.min(saved.nextAt - data.savedAt, 60_000));
      restored.push({ ...m, script, nextAt: now + wait });
    } catch {
      // skip anything that cannot be rebuilt
    }
  }
  if (restored.length === 0) return null;
  const ids = new Set();
  return restored.filter((m) => !ids.has(m.id) && ids.add(m.id));
}

export function loadMissions(now = Date.now()) {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const missions = deserialize(raw, now);
    if (!missions) s.removeItem(STORAGE_KEY); // corrupt or outdated: start clean
    return missions;
  } catch {
    return null;
  }
}

export function saveMissions(missions, now = Date.now()) {
  const s = store();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, serialize(missions, now));
  } catch {
    // quota exceeded or storage revoked: keep running in memory
  }
}

export function clearMissions() {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
