import { describe, expect, it } from 'vitest';
import { compilePlan } from './compile';

// The shape an AI (Live Mode) plan arrives in: only the shared MissionPlan fields.
const AI_PLAN = {
  kind: 'dynamic',
  goal: 'Coffee meeting tomorrow at 10 am',
  intent: { objective: 'Schedule a coffee meeting', domain: 'personal', desiredOutcome: 'Meeting booked' },
  tasks: [
    { id: 'p1', title: 'Create event', agent: 'execution', type: 'schedule', capability: 'calendar', deps: [], gated: true, inputs: {} },
    { id: 'p2', title: 'Verify', agent: 'verification', type: 'verify', capability: 'verification', deps: ['p1'], gated: false, inputs: {} },
  ],
  criteria: [{ label: 'Meeting booked', taskId: 'p2' }],
  metric: { kind: 'criteria', label: 'Success criteria met', target: 1 },
  approvalPoints: 1,
  capabilities: ['calendar', 'verification'],
};

describe('replaying an AI plan', () => {
  it('compiles without the rule-based extras (assumptions, domainLabel)', () => {
    expect(() => compilePlan(AI_PLAN)).not.toThrow();
    expect(compilePlan(AI_PLAN)).toBeTruthy();
  });
});
