import { ops } from './ops';

const { say, status, addTask, task, metricSet, metricAdd, browse, bstep, check, recovery } = ops;

// A step: wait `delay` ms (at 1x), then apply every op in order.
const s = (delay, ...fns) => ({ delay, run: (m) => fns.reduce((acc, f) => f(acc), m) });

export function buildScript(goal) {
  return /registration|sign.?up|attendee/i.test(goal) ? registrations(goal) : generic(goal);
}

// ---------------------------------------------------------------------------
// Hero demo: "Get 100 registrations for our hackathon"

function registrations(goal) {
  const tasks = [
    { id: 't1', title: 'Research the audience', agent: 'research', deps: [] },
    { id: 't2', title: 'Build registration form', agent: 'browser', deps: ['t1'] },
    { id: 't3', title: 'Draft the invite email', agent: 'execution', deps: ['t1'] },
    { id: 't4', title: 'Review the draft', agent: 'critic', deps: ['t3'] },
    { id: 't5', title: 'Email 480 past attendees', agent: 'execution', deps: ['t2', 't4'], gated: true },
    { id: 't6', title: 'Post in community channels', agent: 'browser', deps: ['t2'] },
    { id: 't7', title: 'Verify 100 real sign-ups', agent: 'verification', deps: ['t5', 't6'] },
  ];

  const payload = {
    from: 'events@hackos.dev',
    to: '480 past attendees',
    subject: '48 hours, $5,000 in prizes. Registration closes Friday',
    body:
      "Hi there,\n\nHackOS 2026 is back on Oct 18–19. Build anything in 48 hours, with $5,000 in prizes and mentors from top startups.\n\nRegister in 30 seconds: forms.gle/agentos-hack\n\nSee you there,\nThe HackOS team",
  };

  const approve = (edited) => [
    s(600, say('approval', edited ? 'Approved with your edits. Resuming.' : 'Approved. Resuming the mission.', 'approval'),
      status('running'), task('t5', { status: 'running' })),
    s(1400, say('execution', 'Sending in batches of 60 to stay under spam limits.')),
    s(1600, say('execution', '480 of 480 delivered. 3 bounced.', 'action'), task('t5', { status: 'done' }), metricSet(18)),
    s(1200, metricSet(41), say('execution', '41 registrations from the first wave.')),
  ];

  const reject = () => [
    s(600, say('approval', 'Rejected. No emails will be sent.', 'approval'), status('running'), task('t5', { status: 'skipped' })),
    s(1300, say('planner', 'Re-planning without email: asking the 3 club leads to share the form instead.', 'plan'),
      addTask({ id: 't5b', title: 'Ask club leads to share', agent: 'execution', deps: ['t2'], status: 'running' }),
      task('t7', (t) => ({ deps: [...t.deps.filter((d) => d !== 't5'), 't5b'] }))),
    s(1800, say('execution', 'All 3 club leads shared the form in their groups.', 'action'), task('t5b', { status: 'done' }), metricSet(29)),
  ];

  return {
    metric: { label: 'Verified registrations', current: 0, target: 100 },
    script: [
      s(500, say('system', `Mission received: “${goal}”`, 'system')),
      s(1300, say('planner', 'Reading the goal. Success means 100 real, verified registrations.')),
      ...tasks.map((t) => s(320, addTask(t))),
      s(700, say('planner', 'Plan ready: 7 tasks. The form and the outreach will run in parallel.', 'plan'), status('running')),
      s(800, task('t1', { status: 'running' }), say('execution', 'Research, you’re up. Who should we invite?')),
      s(1700, say('research', 'Found 480 past attendees in last year’s sign-up sheet and 3 student clubs with active Discord servers.')),
      s(1300, say('research', 'Engagement peaks Tuesday at 6 PM. Similar events convert 20–25% of invites.'), task('t1', { status: 'done' })),
      s(700, task('t2', { status: 'running' }), task('t3', { status: 'running' }),
        say('execution', 'Browser, build the form. I’ll draft the invite in parallel.')),
      s(900, browse({ url: 'https://docs.google.com/forms', title: 'Google Forms' }), bstep('Opened Google Forms')),
      s(1000, bstep('Created form “HackOS 2026 Registration”')),
      s(1000, bstep('Added fields: name, email, college, team size')),
      s(1000, bstep('Turned on confirmation emails')),
      s(900, browse({ url: 'https://forms.gle/agentos-hack' }), bstep('Published the form'),
        say('browser', 'Form is live at forms.gle/agentos-hack.', 'action'), task('t2', { status: 'done' })),
      s(900, say('execution', 'Draft ready: “You’re invited to HackOS 2026”.'), task('t3', { status: 'done' }), task('t4', { status: 'running' })),
      s(1500, say('critic', 'The subject line is generic and there’s no deadline. Lead with the prize and “closes Friday”.', 'critique')),
      s(1200, say('execution', `Revised subject: “${payload.subject}”.`), task('t4', { status: 'done' })),
      s(900, task('t5', { status: 'awaiting' }),
        say('approval', 'This emails 480 people from events@hackos.dev. Pausing for your approval.', 'approval')),
      {
        delay: 300,
        approval: {
          title: 'Send invite email to 480 people',
          agent: 'approval',
          risk: 'medium',
          reason: 'Sends email on your behalf to people outside your team.',
          payload,
        },
        approve,
        reject,
      },
      // Shared tail. The failure below happens on every run: recovery is the point of the demo.
      s(800, task('t6', { status: 'running' }),
        browse({ url: 'https://discord.com/channels/hackclub/events', title: 'Discord · #events' }),
        bstep('Opened #events in the Hack Club server')),
      s(1000, bstep('Typed the announcement with the form link')),
      s(1200, bstep('Post rejected: “New members can’t post links”', 'failed'),
        task('t6', { status: 'failed' }), status('recovering'),
        say('browser', 'Discord rejected the post: new members can’t share links.', 'failure'),
        recovery({ id: 'r1', task: 'Post in community channels', error: 'Discord blocked the post. New members can’t share links.', status: 'diagnosing' })),
      s(1300, say('recovery', 'Failure detected in “Post in community channels”. Diagnosing…', 'recovery')),
      s(1700, recovery({ id: 'r1', diagnosis: 'This server blocks links from accounts under 7 days old. Retrying the same post will fail again.', status: 'replanning' }),
        say('recovery', 'Root cause: this server blocks links from accounts newer than 7 days. A plain retry won’t work.', 'recovery')),
      s(1700, recovery({ id: 'r1', plan: 'Post the invite as an image with a QR code (no link), then ask a moderator to pin it.', status: 'retrying' }),
        say('recovery', 'New plan: post the invite as an image with a QR code, then ask a moderator to pin it.', 'recovery'),
        task('t6', { status: 'running' })),
      s(1000, say('critic', 'Good call. An image stands out more in the feed anyway.', 'critique'),
        bstep('Generated an invite image with a QR code')),
      s(1100, bstep('Posted the image in #events'), bstep('Asked @mod-riya to pin it')),
      s(1300, bstep('Post pinned by a moderator'), recovery({ id: 'r1', status: 'resolved' }), status('running'),
        task('t6', { status: 'done' }), metricAdd(35),
        say('recovery', 'Recovered. The post is live and pinned. Mission back on track.', 'recovered')),
      s(1500, metricAdd(22), say('execution', (m) => `${m.metric.current} registrations. The Discord post is driving traffic.`)),
      s(900, task('t7', { status: 'running' }), say('verification', 'Checking every response against the goal…')),
      s(1200, check((m) => `${m.metric.current} form responses received`)),
      s(1000, check('6 duplicate entries removed', 'warn'), check('2 invalid emails removed', 'warn'), metricAdd(-8)),
      s(1200, say('verification', (m) => `Only ${m.metric.current} real registrations. That’s below the target of 100.`, 'failure'),
        check((m) => `${m.metric.current} verified, short of 100`, 'failed'), task('t7', { status: 'failed' })),
      s(1400, say('planner', 'Adding a follow-up: remind the 60 people who opened the form but didn’t submit.', 'plan'),
        addTask({ id: 't8', title: 'Remind unfinished sign-ups', agent: 'execution', deps: ['t7'], status: 'running' })),
      s(1800, say('execution', 'Reminder sent to 60 people who started the form.', 'action'), task('t8', { status: 'done' }), metricSet(104)),
      s(1300, task('t7', { status: 'running' }), check('Re-counted after the reminder')),
      s(1200, check('104 verified registrations (target: 100)'), task('t7', { status: 'done' }),
        say('verification', 'Verified: 104 unique, valid registrations. Goal met.', 'verified')),
      s(800, status('completed'), say('system', 'Mission complete: 104 of 100 registrations.', 'complete')),
    ],
  };
}

// ---------------------------------------------------------------------------
// Any other goal: the same agents, a shorter arc, one failure and one approval.

function generic(goal) {
  const tasks = [
    { id: 'g1', title: 'Research the goal', agent: 'research', deps: [] },
    { id: 'g2', title: 'Collect options from the web', agent: 'browser', deps: ['g1'] },
    { id: 'g3', title: 'Compare and shortlist', agent: 'critic', deps: ['g2'] },
    { id: 'g4', title: 'Prepare the action', agent: 'execution', deps: ['g3'] },
    { id: 'g5', title: 'Carry it out', agent: 'execution', deps: ['g4'], gated: true },
    { id: 'g6', title: 'Confirm the outcome', agent: 'verification', deps: ['g5'] },
  ];

  const approve = (edited) => [
    s(600, say('approval', edited ? 'Approved with your edits. Resuming.' : 'Approved. Resuming the mission.', 'approval'),
      status('running'), task('g5', { status: 'running' })),
    s(1600, say('execution', 'Done. Confirmation received and saved.', 'action'), task('g5', { status: 'done' })),
  ];

  const reject = () => [
    s(600, say('approval', 'Rejected. Nothing will be sent.', 'approval'), status('running'), task('g5', { status: 'skipped' })),
    s(1200, say('planner', 'Stopping before the final action. Everything is prepared for you to send yourself.', 'plan')),
  ];

  const search = `https://www.google.com/search?q=${encodeURIComponent(goal)}`;

  return {
    metric: { label: 'Tasks complete', current: 0, target: tasks.length, auto: true },
    script: [
      s(500, say('system', `Mission received: “${goal}”`, 'system')),
      s(1300, say('planner', 'Reading the goal and working out what “done” looks like.')),
      ...tasks.map((t) => s(320, addTask(t))),
      s(700, say('planner', `Plan ready: ${tasks.length} tasks, one approval checkpoint.`, 'plan'), status('running')),
      s(800, task('g1', { status: 'running' }), say('execution', 'Research, what do we need to know first?')),
      s(1700, say('research', 'Key constraints: the deadline, the budget, and who has to be contacted.')),
      s(1200, task('g1', { status: 'done' }), task('g2', { status: 'running' }),
        browse({ url: search, title: 'Web search' }), bstep('Searched the web for sources')),
      s(1100, bstep('Opened the top result')),
      s(1200, bstep('Page failed to load: 503 Service Unavailable', 'failed'), task('g2', { status: 'failed' }), status('recovering'),
        say('browser', 'The top source returned 503 Service Unavailable.', 'failure'),
        recovery({ id: 'r1', task: 'Collect options from the web', error: 'The top source returned 503 Service Unavailable.', status: 'diagnosing' })),
      s(1300, say('recovery', 'Failure detected. Diagnosing…', 'recovery')),
      s(1600, recovery({ id: 'r1', diagnosis: 'The site is down, not blocking us. Waiting could take hours.', status: 'replanning' }),
        say('recovery', 'Root cause: the site itself is down. Waiting could take hours.', 'recovery')),
      s(1500, recovery({ id: 'r1', plan: 'Switch to the next two sources and cross-check what they say.', status: 'retrying' }),
        say('recovery', 'New plan: use the next two sources and cross-check them.', 'recovery'), task('g2', { status: 'running' })),
      s(1000, browse({ url: 'https://news.ycombinator.com' }), bstep('Opened alternate source #2')),
      s(1000, bstep('Opened alternate source #3'), bstep('Extracted 12 candidate options')),
      s(1100, recovery({ id: 'r1', status: 'resolved' }), status('running'), task('g2', { status: 'done' }),
        say('recovery', 'Recovered. 12 options collected from two working sources.', 'recovered')),
      s(900, task('g3', { status: 'running' })),
      s(1500, say('critic', 'Shortlisted 3 options. Dropped 9 that miss the deadline or the budget.', 'critique'), task('g3', { status: 'done' })),
      s(900, task('g4', { status: 'running' })),
      s(1400, say('execution', 'Prepared the submission for the top option.'), task('g4', { status: 'done' }),
        task('g5', { status: 'awaiting' }), say('approval', 'The next step acts on your behalf. Pausing for your approval.', 'approval')),
      {
        delay: 300,
        approval: {
          title: 'Act on your behalf',
          agent: 'approval',
          risk: 'medium',
          reason: 'Sends a submission to an outside party in your name.',
          payload: {
            from: 'you@yourdomain.com',
            to: 'Top shortlisted option',
            subject: goal,
            body: `Hi,\n\nI'm reaching out about: ${goal}.\n\nDetails are attached. Please confirm when you can.\n\nThanks`,
          },
        },
        approve,
        reject,
      },
      s(900, task('g6', { status: 'running' }), say('verification', 'Checking every task against the goal…')),
      s(1200, check('Every task produced an output'), check((m) =>
        m.tasks.some((t) => t.id === 'g5' && t.status === 'skipped') ? 'Final action left for you to send' : 'Confirmation saved')),
      s(900, task('g6', { status: 'done' }), say('verification', 'Verified. The outcome matches the goal.', 'verified')),
      s(700, status('completed'), say('system', 'Mission complete.', 'complete')),
    ],
  };
}
