import { describe, expect, it } from 'vitest';
import { getProofState } from './proof';

describe('Proof Panel State (getProofState)', () => {
  it('identifies incomplete mission as not verified', () => {
    const m = {
      status: 'running',
      tasks: [],
      approvals: [],
      recoveries: [],
      checks: [{ status: 'done', label: 'C1' }]
    };
    const state = getProofState(m);
    expect(state.isVerified).toBe(false);
  });

  it('identifies completed mission with all criteria checked as verified', () => {
    const m = {
      status: 'completed',
      tasks: [],
      approvals: [],
      recoveries: [],
      checks: [{ status: 'done', label: 'C1' }]
    };
    const state = getProofState(m);
    expect(state.isVerified).toBe(true);
  });

  it('does not verify completed mission if a check failed or is missing', () => {
    const m = {
      status: 'completed',
      tasks: [],
      approvals: [],
      recoveries: [],
      checks: [{ status: 'failed', label: 'C1' }]
    };
    expect(getProofState(m).isVerified).toBe(false);

    const m2 = {
      ...m,
      checks: [] // missing checks entirely
    };
    expect(getProofState(m2).isVerified).toBe(false);
  });

  it('represents failed and recovered tasks correctly', () => {
    const m = {
      status: 'running',
      tasks: [
        { id: 't1', title: 'Task 1', status: 'failed', agent: 'test' },
        { id: 't2', title: 'Task 2', status: 'done', agent: 'test' }
      ],
      approvals: [],
      recoveries: [
        { task: 'Task 1', error: 'Network error', status: 'resolved', plan: 'Retry' }
      ]
    };
    const state = getProofState(m);
    expect(state.summary.failedTasks).toBe(1);
    expect(state.summary.recoveries).toBe(1);
    
    const t1 = state.taskResults.find(t => t.id === 't1');
    expect(t1.recovery).toEqual({ error: 'Network error', status: 'resolved', plan: 'Retry' });
  });

  it('represents pending approval clearly', () => {
    const m = {
      status: 'awaiting_approval',
      tasks: [
        { id: 't1', title: 'Send Email', status: 'pending', agent: 'email' }
      ],
      approvals: [
        { title: 'Send Email', status: 'pending', reason: 'User must confirm.' }
      ],
      recoveries: []
    };
    const state = getProofState(m);
    expect(state.summary.pendingApprovals).toBe(1);
    expect(state.verification.hasPendingApprovals).toBe(true);
    
    const t1 = state.taskResults.find(t => t.id === 't1');
    expect(t1.approval.status).toBe('pending');
  });

  it('gracefully handles missing evidence / recoveries', () => {
    const m = {
      status: 'running',
      tasks: [
        { id: 't1', title: 'No issue task', status: 'done', agent: 'test' }
      ],
      approvals: [],
      recoveries: []
    };
    const state = getProofState(m);
    const t1 = state.taskResults.find(t => t.id === 't1');
    expect(t1.recovery).toBeNull();
    expect(t1.approval).toBeNull();
  });
});
