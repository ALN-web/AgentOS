import { describe, expect, it } from 'vitest';
import { analyzeGoal } from './intent';
import { planMission } from './planner';
import { CAPABILITY_BY_ID } from './capabilities';
import { advance, createMission, replayTo, resolveApproval } from '../engine/engine';
import { deserialize, serialize } from '../store/persistence';

const T0 = 1_700_000_000_000;

// Runs a mission, answering every approval with `decision`.
function run(goal, decision = 'approve', answers) {
  let m = createMission(goal, { createdAt: T0, plan: planMission(goal, answers) });
  let now = m.nextAt;
  for (let i = 0; i < 1000 && m.status !== 'completed'; i++) {
    if (m.status === 'awaiting_approval') {
      const pending = m.approvals.find((a) => a.status === 'pending');
      m = resolveApproval(m, pending.id, decision, null, now);
    }
    now = Math.max(now, m.nextAt);
    m = advance(m, now);
  }
  return m;
}

const GOALS = [
  'Organize a hackathon in our college',
  'Find 20 internships suitable for me',
  'Plan a technical workshop for 100 students',
  'Help me prepare for an upcoming product launch',
  'Research our top 3 competitors',
  'Get 3 quotes for 20 office monitors under $250 each',
  'Invoice all clients for September and chase overdue payments',
  'Learn Spanish basics and book a tutor',
  'Write a newsletter about our new cafeteria menu',
  'Plan my week around my deadlines',
  'Reply to the emails that need me today',
  'Organise a birthday dinner for 8 on Saturday',
  "Remind me to pay my bills before they're due",
  'Book a dentist appointment next week',
  'Plan a weekend trip to Goa for 4 friends under ₹20,000',
];

describe('goal understanding', () => {
  it('turns free text into a structured intent', () => {
    const i = analyzeGoal('Plan a technical workshop for 100 students next Friday, online');
    expect(i.domain).toBe('event_management');
    expect(i.quantity).toEqual({ n: 100, unit: 'students' });
    expect(i.date).toMatch(/next friday/i);
    expect(i.format).toBe('online');
    expect(i.questions).toEqual([]);
  });

  it('asks only for critical details that are missing', () => {
    const vague = analyzeGoal('Organize a hackathon');
    expect(vague.questions.map((q) => q.id)).toEqual(['participants', 'date', 'format']);
    const specific = analyzeGoal('Organize an online hackathon for 200 people on Nov 14');
    expect(specific.questions).toEqual([]);
  });

  it('reads quantities past leading adjectives', () => {
    expect(analyzeGoal('Find 20 suitable internship opportunities.').quantity).toEqual({ n: 20, unit: 'internship opportunities' });
    expect(analyzeGoal('Find 20 internships suitable for me').quantity).toEqual({ n: 20, unit: 'internships' });
    expect(planMission('Find 20 suitable internship opportunities.').metric.target).toBe(20);
    expect(analyzeGoal('Find 20 suitable internship opportunities.').questions.map((q) => q.id)).not.toContain('count');
  });

  it('adapts event plans to the kind of event', () => {
    const hack = planMission('Organize a hackathon event in our college.').tasks.map((t) => t.title);
    const shop = planMission('Plan a technical workshop for 100 students.').tasks.map((t) => t.title);
    expect(hack).toContain('Set up judging, prizes and mentors');
    expect(shop).toContain('Prepare speakers and session materials');
    expect(hack).not.toEqual(shop);
  });

  it('uses answers and states assumptions for anything still unknown', () => {
    const answered = analyzeGoal('Organize a hackathon', { participants: '150', date: 'Nov 14', format: 'Hybrid' });
    expect(answered.quantity).toEqual({ n: 150, unit: 'participants' });
    expect(answered.format).toBe('hybrid');
    expect(answered.questions).toEqual([]);
    expect(analyzeGoal('Organize a hackathon').assumptions.length).toBeGreaterThan(0);
  });

  it('flags actions with external consequences', () => {
    expect(analyzeGoal('Email the team the report').risks.map((r) => r.id)).toContain('communication');
    expect(analyzeGoal('Buy 5 laptops').risks.map((r) => r.id)).toContain('purchase');
    expect(analyzeGoal('Summarise this article').risks).toEqual([]);
  });

  it('never rejects a goal it has no domain for', () => {
    const i = analyzeGoal('Write a newsletter about our new cafeteria menu');
    expect(i.domain).toBe('general');
    expect(planMission(i.goal).tasks.length).toBeGreaterThan(3);
  });

  it('classifies everyday goals to personal domain', () => {
    expect(analyzeGoal('Plan my week around my deadlines').domain).toBe('personal');
    expect(analyzeGoal('Reply to the emails that need me today').domain).toBe('personal');
    expect(analyzeGoal('Organise a birthday dinner for 8 on Saturday').domain).toBe('personal');
    expect(analyzeGoal("Remind me to pay my bills before they're due").domain).toBe('personal');
    expect(analyzeGoal('Book a dentist appointment next week').domain).toBe('personal');
    expect(analyzeGoal('Plan a weekend trip to Goa for 4 friends under ₹20,000').domain).toBe('personal');
  });

  it('extracts everyday details', () => {
    const i = analyzeGoal('Plan a weekend trip to Goa for 4 friends under ₹20,000 before Friday');
    expect(i.quantity).toEqual({ n: 4, unit: 'friends' });
    expect(i.place).toBe('Goa');
    expect(i.constraints).toContain('Budget: under ₹20,000');
    expect(i.constraints).toContain('Deadline: before Friday');
    
    const b = analyzeGoal('Organise a birthday dinner for 8 on Saturday at 7 pm');
    expect(b.date).toMatch(/saturday at 7 pm/i);
    expect(b.people).toMatch(/for 8/i);
  });
});

describe('dynamic planning', () => {
  it('produces different plans for different goals', () => {
    const titles = GOALS.map((g) => planMission(g).tasks.map((t) => t.title).join('|'));
    expect(new Set(titles).size).toBe(GOALS.length);
  });

  it('is deterministic for the same goal', () => {
    expect(planMission(GOALS[0])).toEqual(planMission(GOALS[0]));
  });

  it('assigns every task an agent through the capability registry', () => {
    for (const g of GOALS) {
      for (const t of planMission(g).tasks) {
        expect(CAPABILITY_BY_ID[t.capability]).toBeDefined();
        expect(t.agent).toBe(CAPABILITY_BY_ID[t.capability].agent);
      }
    }
  });

  it('gates every external action behind approval', () => {
    for (const g of GOALS) {
      const p = planMission(g);
      for (const t of p.tasks) expect(t.gated).toBe(!!CAPABILITY_BY_ID[t.capability].external);
      expect(p.approvalPoints).toBe(p.tasks.filter((t) => t.gated).length);
    }
  });

  it('adds approval-gated tasks for risky verbs the blueprint lacks', () => {
    const p = planMission('Research our top 3 competitors and email the findings to the team');
    expect(p.tasks.some((t) => t.gated && t.capability === 'communication')).toBe(true);
  });

  it('names what an unfamiliar goal asks for, and who it goes to', () => {
    const p = planMission('Write a newsletter about our new cafeteria menu and email it to all staff');
    const titles = p.tasks.map((t) => t.title);
    expect(titles).toContain('Write the newsletter');
    expect(titles).toContain('Send the newsletter to all staff');
    expect(p.tasks.find((t) => t.title === 'Send the newsletter to all staff').gated).toBe(true);
  });

  it('names booking actions as bookings', () => {
    expect(planMission('Learn Spanish basics and book a tutor').tasks.map((t) => t.title)).toContain('Make the booking');
    expect(planMission('Summarise the report and order lunch').tasks.map((t) => t.title)).toContain('Place the order');
  });

  it('always ends with verification and has success criteria', () => {
    for (const g of GOALS) {
      const p = planMission(g);
      expect(p.tasks[p.tasks.length - 1].type).toBe('verify');
      expect(p.criteria.length).toBeGreaterThan(0);
    }
  });

  it('keeps dependencies pointing at earlier tasks', () => {
    for (const g of GOALS) {
      const ids = [];
      for (const t of planMission(g).tasks) {
        t.deps.forEach((d) => expect(ids).toContain(d));
        ids.push(t.id);
      }
    }
  });

  it('plans are plain data', () => {
    const p = planMission(GOALS[1]);
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });
});

describe('dynamic missions run on the existing engine', () => {
  for (const goal of GOALS) {
    it(`completes: ${goal}`, () => {
      const m = run(goal);
      expect(m.status).toBe('completed');
      expect(m.events.filter((e) => e.type === 'failure')).toHaveLength(1);
      expect(m.recoveries).toHaveLength(1);
      expect(m.recoveries[0].status).toBe('resolved');
      const idx = (type) => m.events.findIndex((e) => e.type === type);
      expect(idx('recovery')).toBeGreaterThan(idx('failure'));
      expect(idx('verified')).toBeGreaterThan(idx('recovered'));
      expect(m.metric.current).toBe(m.metric.target);
      expect(m.tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped')).toEqual([]);
    });
  }

  it('recovery replaces the failed task in the graph and re-points its dependents', () => {
    const m = run(GOALS[0]);
    const failed = m.tasks.find((t) => t.replacedBy);
    const alt = m.tasks.find((t) => t.id === failed.replacedBy);
    expect(failed.status).toBe('skipped');
    expect(alt.status).toBe('done');
    expect(m.tasks.some((t) => t.deps.includes(failed.id))).toBe(false);
    expect(m.tasks.some((t) => t.deps.includes(alt.id))).toBe(true);
  });

  it('rejection skips the action, re-plans, and verification reports it as open', () => {
    const m = run(GOALS[0], 'reject');
    expect(m.status).toBe('completed');
    const gated = m.tasks.find((t) => t.gated);
    expect(gated.status).toBe('skipped');
    expect(m.events.some((e) => e.agent === 'planner' && e.text.startsWith('Re-planned without'))).toBe(true);
    expect(m.checks.some((c) => c.status === 'warn')).toBe(true);
    expect(m.metric.current).toBeLessThan(m.metric.target);
  });

  it('an edited approval changes the simulated action', () => {
    const goal = GOALS[0];
    let m = createMission(goal, { createdAt: T0 });
    let now = m.nextAt;
    while (m.status !== 'awaiting_approval') {
      now = Math.max(now, m.nextAt);
      m = advance(m, now);
    }
    m = resolveApproval(m, m.approvals[0].id, 'edit', { recipients: 250, subject: 'Hackathon: last call' }, now);
    while (m.status !== 'completed') {
      now = Math.max(now, m.nextAt);
      m = advance(m, now);
    }
    expect(m.events.some((e) => e.text.includes('“Hackathon: last call” to 250'))).toBe(true);
  });

  it('replays and survives a save/restore like the hero mission', () => {
    const m = run(GOALS[2], 'approve');
    expect(replayTo(m, Infinity).events.map((e) => e.text)).toEqual(m.events.map((e) => e.text));
    const [restored] = deserialize(serialize([m], T0), T0 + 1000);
    expect(restored.plan).toEqual(m.plan);
    expect(restored.status).toBe('completed');
  });

  it('clarification answers change the plan', () => {
    const a = planMission('Organize a hackathon', { format: 'Online' });
    const b = planMission('Organize a hackathon', { format: 'In person' });
    expect(a.tasks.map((t) => t.title)).toContain('Choose an online platform');
    expect(b.tasks.map((t) => t.title)).toContain('Research venue and resources');
  });
});

describe('hero mission', () => {
  it('keeps its curated plan', () => {
    const p = planMission('Get 100 registrations for our college hackathon');
    expect(p.kind).toBe('hero');
    expect(p.tasks).toHaveLength(7);
    expect(p.intent.questions).toEqual([]);
  });
});
