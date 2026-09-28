// Pure state operations used by scenarios. Each returns (mission) => mission.

const val = (x, m) => (typeof x === 'function' ? x(m) : x);

export const ops = {
  say: (agent, text, type = 'message') => (m) => ({
    ...m,
    events: [...m.events, { id: `${m.id}_e${m.events.length}`, t: m.clock, agent, type, text: val(text, m) }],
  }),
  status: (status) => (m) => ({ ...m, status }),
  addTask: (task) => (m) => withAutoMetric({ ...m, tasks: [...m.tasks, { status: 'pending', ...task }] }),
  task: (id, patch) => (m) =>
    withAutoMetric({ ...m, tasks: m.tasks.map((t) => (t.id === id ? { ...t, ...val(patch, t) } : t)) }),
  metricSet: (n) => (m) => ({ ...m, metric: { ...m.metric, current: n } }),
  metricAdd: (n) => (m) => ({ ...m, metric: { ...m.metric, current: m.metric.current + n } }),
  browse: (patch) => (m) => ({ ...m, browser: { ...m.browser, ...patch } }),
  bstep: (text, status = 'done') => (m) => ({
    ...m,
    browser: { ...m.browser, steps: [...m.browser.steps, { text: val(text, m), status, t: m.clock }] },
  }),
  check: (label, status = 'done') => (m) => ({ ...m, checks: [...m.checks, { label: val(label, m), status }] }),
  recovery: (patch) => (m) => {
    const exists = m.recoveries.some((r) => r.id === patch.id);
    const recoveries = exists
      ? m.recoveries.map((r) => (r.id === patch.id ? { ...r, ...patch } : r))
      : [...m.recoveries, { startedAt: m.clock, ...patch }];
    return { ...m, recoveries };
  },
};

function withAutoMetric(m) {
  if (!m.metric.auto) return m;
  const counted = m.tasks.filter((t) => t.status !== 'skipped');
  return {
    ...m,
    metric: { ...m.metric, current: counted.filter((t) => t.status === 'done').length, target: counted.length },
  };
}
