import { taskCounts } from './selectors';

export function getProofState(m) {
  if (!m) return null;

  const { total, done } = taskCounts(m);
  const failedTasks = m.tasks.filter(t => t.status === 'failed').length;
  const recoveries = m.recoveries || [];
  const checks = m.checks || [];
  const criteria = m.plan?.criteria || [];
  const pendingApprovals = m.approvals.filter(a => a.status === 'pending');
  const decidedApprovals = m.approvals.filter(a => a.status !== 'pending');

  const isVerified = m.status === 'completed' && checks.length > 0 && checks.every(c => c.status === 'done');

  return {
    isVerified,
    summary: {
      totalTasks: total,
      doneTasks: done,
      failedTasks,
      recoveries: recoveries.length,
      pendingApprovals: pendingApprovals.length,
      decidedApprovals: decidedApprovals.length
    },
    verification: {
      checks,
      criteria,
      hasPendingApprovals: pendingApprovals.length > 0
    },
    taskResults: m.tasks.map(t => {
      const rec = recoveries.find(r => r.task === t.title);
      const approval = m.approvals.find(a => a.title === t.title);
      
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        agent: t.agent,
        recovery: rec ? { error: rec.error, status: rec.status, plan: rec.plan } : null,
        approval: approval ? { status: approval.status, reason: approval.reason } : null
      };
    })
  };
}
