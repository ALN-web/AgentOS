// Planning blueprints: reusable starting shapes for broad kinds of goals.
//
// A blueprint is not a script for one problem. It is a sequence of typed tasks
// (analyze, research, browse, communicate, verify, ...) whose titles, numbers
// and success criteria are filled in from the Mission Intent. The planner then
// adds approval gates, risk-driven tasks, a failure point and verification.
// Unknown goals use the general blueprint, so no goal is ever rejected.
//
// Step fields: key, type, title, deps (keys), why { objective, reason },
// out (what the agent reports), criterion (a success criterion it satisfies),
// progress (fraction of a quantity target reached when it completes),
// site + steps (for browser work), payload (for external actions),
// fail (preferred place for a failure to surface).

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function event(ctx) {
  const ev = ctx.eventNoun;
  const n = ctx.quantity?.n || 100;
  const online = ctx.format === 'online';
  const when = ctx.date ? ` on ${ctx.date}` : '';
  const reach = n * 4;
  return [
    {
      key: 'scope', type: 'analyze', title: `Understand the ${ev} requirements`, deps: [],
      why: { objective: `Define what a successful ${ev} looks like.`, reason: 'Every later task is judged against this definition of ready.' },
      out: `Scope: ${n} participants, ${ctx.format || 'in person'}${when}. Ready means venue, plan, registration, promotion and team are all in place.`,
    },
    {
      key: 'venue', type: 'research', title: online ? 'Choose an online platform' : 'Research venue and resources', deps: ['scope'],
      why: { objective: online ? 'Pick a platform that fits the format.' : `Find a space that fits ${n} people.`, reason: 'Capacity and facilities decide what the rest of the plan can promise.' },
      out: online ? 'Compared 3 platforms. Picked one with breakout rooms and a 300-person limit.' : `Found 3 rooms that fit ${n} people. The main hall has the best power and Wi-Fi.`,
      criterion: online ? 'Platform chosen' : 'Venue and resources identified',
    },
    {
      key: 'plan', type: 'create', title: `Define the ${ev} structure and timeline`, deps: ['scope'],
      why: { objective: 'Turn the scope into a schedule people can follow.', reason: 'Registration, promotion and the team all hang off the timeline.' },
      out: `Drafted the run of show and a six-week countdown: promotion, registration close, final briefing.`,
      criterion: 'Event plan and timeline complete',
    },
    {
      key: 'register', type: 'browse', title: 'Create the registration workflow', deps: ['plan'],
      why: { objective: 'Give participants one place to sign up.', reason: 'Promotion needs a working link before it goes out.' },
      site: 'forms.example.com', siteTitle: 'Form builder (simulated)',
      steps: ['Opened the form builder', `Created “${cap(ev)} registration”`, 'Added fields: name, email, team, dietary needs', 'Published the form'],
      out: 'Registration form creation simulated. Demo link: forms.example.com/register.',
      criterion: 'Registration workflow ready', fail: true,
    },
    {
      key: 'promo', type: 'draft', title: 'Prepare promotion content', deps: ['plan'],
      why: { objective: 'Give people a reason to sign up.', reason: 'A clear date, prize or benefit converts far better than a generic invite.' },
      out: `Drafted an announcement, a poster brief and a reminder for the ${ev}.`,
    },
    {
      key: 'review', type: 'compare', title: 'Review the promotion plan', deps: ['promo'],
      why: { objective: 'Catch weak spots before anything goes public.', reason: 'Published content can’t be improved after people have seen it.' },
      out: 'The announcement buries the date. Moved it to the first line and added a deadline.',
    },
    {
      key: 'announce', type: 'communicate', title: `Publish the ${ev} announcement`, deps: ['register', 'review'],
      why: { objective: 'Reach the people who should attend.', reason: 'This publishes content in your name, so it waits for your approval.' },
      payload: {
        from: 'organisers@college.example',
        recipients: reach,
        audience: 'students and club members',
        subject: `${cap(ev)}${when}: registration is open`,
        body: `Hi all,\n\nOur ${ev} is happening${when}. Spots are limited to ${n}.\n\nRegister here: forms.example.com/register\n\nSee you there!`,
      },
      criterion: 'Promotion approved and published',
    },
    {
      key: 'team', type: 'create', title: 'Assign tasks to the organising team', deps: ['plan', 'venue'],
      why: { objective: 'Make every part of the day someone’s job.', reason: 'Unowned tasks are the ones that get missed.' },
      out: 'Assigned owners for venue, registration desk, food, judging and communications.',
      criterion: 'Tasks assigned',
    },
    {
      key: 'monitor', type: 'monitor', title: 'Monitor registrations', deps: ['announce'],
      why: { objective: `Track sign-ups toward ${n}.`, reason: 'Progress is only visible if someone is counting.' },
      out: `Simulated registrations: ${Math.round(n * 0.6)} after two days, trending to ${n}.`,
    },
    {
      key: 'verify', type: 'verify', title: `Verify ${ev} readiness`, deps: ['team', 'monitor'],
      why: { objective: 'Confirm every readiness criterion is met.', reason: 'The mission is not done until readiness is checked.' },
    },
  ];
}

function career(ctx) {
  const n = ctx.quantity?.n || 10;
  const unit = ctx.quantity?.unit || 'opportunities';
  const field = (ctx.constraints.find((c) => c.startsWith('Field')) || '').replace('Field: ', '');
  const found = Math.ceil(n * 1.7);
  const matched = Math.ceil(n * 1.15);
  const apply = ctx.risks.some((r) => r.id === 'submission');
  const top = Math.min(3, n);
  const steps = [
    {
      key: 'profile', type: 'analyze', title: 'Understand your profile and preferences', deps: [],
      why: { objective: 'Know what a good match looks like for you.', reason: 'Filtering without criteria just returns noise.' },
      out: `Looking for ${n} ${unit}${field ? ` in ${field}` : ''}. Fit is judged on skills, location and deadline.`,
    },
    {
      key: 'search', type: 'search', title: `Search for ${unit}`, deps: ['profile'],
      why: { objective: 'Collect candidates from several job boards.', reason: 'One source is never complete.' },
      site: 'jobs.example.com', siteTitle: 'Job board (simulated)',
      steps: ['Opened three job boards', `Searched “${field || 'internship'}”`, `Collected ${found} listings`],
      out: `Found ${found} candidate listings across three boards.`, fail: true,
    },
    {
      key: 'filter', type: 'compare', title: 'Filter by fit', deps: ['search'],
      why: { objective: 'Keep only listings that match your profile.', reason: 'A short, relevant list is more useful than a long one.' },
      out: `${matched} of ${found} match your skills and location.`,
    },
    {
      key: 'check', type: 'research', title: 'Check each listing is still open', deps: ['filter'],
      why: { objective: 'Make sure every opportunity is real and current.', reason: 'Closed or duplicate listings waste applications.' },
      out: `${matched - n} listings had closed. ${n} verified as open.`, progress: 1,
    },
    {
      key: 'shortlist', type: 'create', title: 'Build the shortlist', deps: ['check'],
      why: { objective: 'Rank the verified opportunities.', reason: 'You should see the best options first.' },
      out: `Shortlist ranked by fit and deadline. Top ${top} flagged for applications.`,
      criterion: `${n} verified ${unit} shortlisted`,
    },
    {
      key: 'materials', type: 'draft', title: 'Tailor application materials', deps: ['shortlist'],
      why: { objective: 'Match your CV and cover note to each role.', reason: 'Tailored applications get more replies.' },
      out: `Drafted ${plural(top, 'cover note')} and highlighted the matching projects in your CV.`,
      criterion: 'Application materials ready',
    },
  ];
  if (apply) {
    steps.push(
      {
        key: 'submit', type: 'submit', title: `Submit applications to the top ${top}`, deps: ['materials'],
        why: { objective: 'Apply to the best matches.', reason: 'Submitting in your name is irreversible, so it waits for your approval.' },
        payload: {
          from: 'you@example.com',
          to: `Top ${top} shortlisted companies`,
          subject: `Application: ${field || 'internship'} role`,
          body: 'Hello,\n\nPlease find my application attached. I would love to contribute to your team.\n\nBest regards',
        },
        criterion: 'Applications submitted (with approval)',
      },
      {
        key: 'track', type: 'monitor', title: 'Track application status', deps: ['submit'],
        why: { objective: 'Know where each application stands.', reason: 'Follow-ups matter as much as the first send.' },
        out: 'Tracker set up with a follow-up reminder in one week.',
      },
    );
  }
  steps.push({
    key: 'verify', type: 'verify', title: `Verify ${n} ${unit}`, deps: [apply ? 'track' : 'materials'],
    why: { objective: 'Confirm the target was met with real, open listings.', reason: 'A count only matters if every item was checked.' },
  });
  return steps;
}

function launch(ctx) {
  const when = ctx.date ? ` for ${ctx.date}` : '';
  return [
    {
      key: 'goals', type: 'analyze', title: 'Understand the launch goals', deps: [],
      why: { objective: 'Decide what the launch must achieve.', reason: 'Assets and channels follow from the goal.' },
      out: `Launch${when}. Success: page live, announcement scheduled, team briefed.`,
    },
    {
      key: 'market', type: 'research', title: 'Research the market and competitors', deps: ['goals'],
      why: { objective: 'Position the launch against alternatives.', reason: 'Messaging lands better when it answers “why this one?”.' },
      out: 'Three competitors launched similar features this quarter; none leads with speed. That becomes the angle.',
    },
    {
      key: 'plan', type: 'create', title: 'Create the launch plan and timeline', deps: ['goals'],
      why: { objective: 'Put every launch task on a calendar.', reason: 'Launches slip on the tasks nobody scheduled.' },
      out: 'Timeline: assets T-5 days, page T-2, announcement on the day, follow-up T+2.',
      criterion: 'Launch plan and timeline complete',
    },
    {
      key: 'assets', type: 'draft', title: 'Draft the announcement and assets', deps: ['market', 'plan'],
      why: { objective: 'Prepare everything the launch needs to say.', reason: 'Drafting early leaves time for review.' },
      out: 'Drafted the announcement post, email, and three social snippets.',
    },
    {
      key: 'review', type: 'compare', title: 'Review the launch assets', deps: ['assets'],
      why: { objective: 'Make the message sharp and consistent.', reason: 'Once public, it can’t be taken back.' },
      out: 'Tightened the headline and removed a claim we can’t back up yet.',
      criterion: 'Assets reviewed',
    },
    {
      key: 'page', type: 'browse', title: 'Prepare the launch page', deps: ['plan'],
      why: { objective: 'Have somewhere for people to land.', reason: 'Announcements need a working destination.' },
      site: 'site.example.com', siteTitle: 'Site editor (simulated)',
      steps: ['Opened the site editor', 'Created the launch page from the product template', 'Added pricing and sign-up button', 'Saved as a scheduled draft'],
      out: 'Launch page prepared as a scheduled draft (simulated).', criterion: 'Launch page ready', fail: true,
    },
    {
      key: 'announce', type: 'communicate', title: 'Schedule the launch announcement', deps: ['review', 'page'],
      why: { objective: 'Tell your audience on launch day.', reason: 'This publishes in your name, so it waits for your approval.' },
      payload: {
        from: 'team@product.example',
        recipients: 2400,
        audience: 'newsletter subscribers',
        subject: 'It’s here: our fastest release yet',
        body: 'Hi,\n\nToday we are launching our new release. It is faster, simpler, and ready for you to try.\n\nSee what is new: site.example.com/launch',
      },
      criterion: 'Announcement approved and scheduled',
    },
    {
      key: 'watch', type: 'monitor', title: 'Monitor launch readiness', deps: ['announce'],
      why: { objective: 'Watch for anything that blocks launch day.', reason: 'Problems caught early are cheap to fix.' },
      out: 'All launch tasks on track; no blockers.',
    },
    {
      key: 'verify', type: 'verify', title: 'Verify launch readiness', deps: ['watch'],
      why: { objective: 'Confirm every launch criterion is met.', reason: 'Ready means checked, not assumed.' },
    },
  ];
}

function research(ctx) {
  const n = ctx.quantity?.n || 3;
  return [
    {
      key: 'questions', type: 'analyze', title: 'Define the research questions', deps: [],
      why: { objective: 'Know exactly what to find out.', reason: 'Clear questions keep the research focused.' },
      out: `Questions: who they are, what they offer, pricing, and where each is strongest. Covering ${n}.`,
    },
    {
      key: 'sources', type: 'search', title: 'Search for sources', deps: ['questions'],
      why: { objective: 'Find credible, current sources.', reason: 'Conclusions are only as good as their sources.' },
      site: 'search.example.com', siteTitle: 'Web search (simulated)',
      steps: ['Searched news, product sites and review platforms', 'Opened the top results', 'Saved 14 relevant sources'],
      out: 'Collected 14 sources: product pages, reviews and recent news.', fail: true,
    },
    {
      key: 'collect', type: 'browse', title: 'Collect the data', deps: ['sources'],
      why: { objective: 'Pull the facts that answer each question.', reason: 'Structured data makes comparison honest.' },
      site: 'search.example.com', siteTitle: 'Sources (simulated)',
      steps: ['Extracted features and pricing', 'Captured positioning statements', 'Logged sources for each fact'],
      out: 'Built a comparison table with a source for every cell.',
    },
    {
      key: 'analyze', type: 'compare', title: 'Analyze and compare findings', deps: ['collect'],
      why: { objective: 'Turn data into conclusions.', reason: 'A table is not an answer.' },
      out: 'Two clear gaps stand out: onboarding speed and pricing for small teams.',
      criterion: 'Findings compared',
    },
    {
      key: 'report', type: 'create', title: 'Write the research report', deps: ['analyze'],
      why: { objective: 'Deliver something you can act on.', reason: 'Findings need to be shareable.' },
      out: 'Wrote a two-page report with recommendations and cited sources.',
      criterion: 'Report written with sources',
    },
    {
      key: 'verify', type: 'verify', title: 'Verify sources and claims', deps: ['report'],
      why: { objective: 'Check every claim against its source.', reason: 'Unverified research is a liability.' },
    },
  ];
}

function procurement(ctx) {
  const n = ctx.quantity?.n;
  const unit = ctx.quantity?.unit || 'items';
  const budget = (ctx.constraints.find((c) => c.startsWith('Budget')) || '').replace('Budget: ', '');
  const buy = ctx.risks.some((r) => r.id === 'purchase');
  const steps = [
    {
      key: 'needs', type: 'analyze', title: 'Understand the requirements', deps: [],
      why: { objective: 'Pin down what “good enough” means.', reason: 'Specs and budget decide which options count.' },
      out: `Need ${n ? `${n} ${unit}` : unit}${budget ? `, ${budget}` : ''}. Compare on specs, warranty and delivery time.`,
    },
    {
      key: 'search', type: 'search', title: `Search vendors for ${unit}`, deps: ['needs'],
      why: { objective: 'Find vendors that can supply this.', reason: 'More options mean better prices.' },
      site: 'shop.example.com', siteTitle: 'Vendor search (simulated)',
      steps: ['Searched three marketplaces', 'Filtered by stock and delivery', 'Saved 9 candidate listings'],
      out: 'Found 9 listings from 6 vendors.', fail: true,
    },
    {
      key: 'compare', type: 'compare', title: 'Compare options against the requirements', deps: ['search'],
      why: { objective: 'Keep only options that meet the requirements.', reason: 'Cheap options that miss the spec cost more later.' },
      out: `5 options meet the spec${budget ? ' and budget' : ''}. Top 3 vendors selected.`,
      criterion: 'Options that meet the requirements identified',
    },
    {
      key: 'quotes', type: 'communicate', title: 'Request quotes from the top 3 vendors', deps: ['compare'],
      why: { objective: 'Get firm prices for the order.', reason: 'This contacts vendors in your name, so it waits for your approval.' },
      payload: {
        from: 'purchasing@company.example',
        to: 'Top 3 vendors',
        subject: `Quote request: ${n ? `${n} ${unit}` : unit}`,
        body: `Hello,\n\nPlease send a quote for ${n ? `${n} ${unit}` : unit}${budget ? ` (${budget})` : ''}, including delivery time and warranty.\n\nThank you`,
      },
      criterion: 'Quotes requested (with approval)',
    },
    {
      key: 'collect', type: 'monitor', title: 'Collect and compare quotes', deps: ['quotes'],
      why: { objective: 'Pick the best quote.', reason: 'Price alone is not the decision.' },
      out: 'Three quotes in (simulated). The best balances price, warranty and a 5-day delivery.',
      criterion: 'Best quote identified',
    },
  ];
  if (buy) {
    steps.push({
      key: 'order', type: 'purchase', title: 'Place the order', deps: ['collect'],
      why: { objective: 'Buy the chosen option.', reason: 'Spending money always waits for your approval.' },
      payload: { from: 'purchasing@company.example', to: 'Selected vendor', subject: `Order: ${n ? `${n} ${unit}` : unit}`, body: 'Please process this order as quoted.' },
      criterion: 'Order placed (with approval)',
    });
  }
  steps.push({
    key: 'verify', type: 'verify', title: 'Verify the selection meets the requirements', deps: [buy ? 'order' : 'collect'],
    why: { objective: 'Confirm the choice matches every requirement.', reason: 'Catch mismatches before money moves.' },
  });
  return steps;
}

function outreach(ctx) {
  const n = ctx.quantity?.n || 100;
  const unit = ctx.quantity?.unit || 'sign-ups';
  return [
    {
      key: 'audience', type: 'analyze', title: 'Understand the target audience', deps: [],
      why: { objective: `Know who can become one of the ${n} ${unit}.`, reason: 'Outreach to the wrong people converts nobody.' },
      out: `Target: ${n} ${unit}${ctx.date ? ` by ${ctx.date}` : ''}. Past contacts and partner communities first.`,
    },
    {
      key: 'channels', type: 'research', title: 'Research channels that reach them', deps: ['audience'],
      why: { objective: 'Pick the channels with the best reach.', reason: 'Effort should go where the audience already is.' },
      out: `In the demo data: ${n * 5} past contacts and 3 partner communities.`,
    },
    {
      key: 'page', type: 'browse', title: 'Set up the sign-up page', deps: ['audience'],
      why: { objective: 'Give people one place to sign up.', reason: 'Every message needs a working link.' },
      site: 'forms.example.com', siteTitle: 'Form builder (simulated)',
      steps: ['Opened the form builder', 'Created the sign-up form', 'Added a confirmation message', 'Published the form'],
      out: 'Sign-up page creation simulated. Demo link: forms.example.com/join.', criterion: 'Sign-up page ready', fail: true,
    },
    {
      key: 'draft', type: 'draft', title: 'Draft the outreach message', deps: ['channels'],
      why: { objective: 'Write a message worth acting on.', reason: 'The message decides the conversion rate.' },
      out: 'Drafted a short message with one clear call to action.',
    },
    {
      key: 'review', type: 'compare', title: 'Review the message', deps: ['draft'],
      why: { objective: 'Improve the message before it goes out.', reason: 'A sent message can’t be improved.' },
      out: 'Added a deadline and moved the benefit to the first line.',
    },
    {
      key: 'send', type: 'communicate', title: 'Send the outreach', deps: ['page', 'review'],
      why: { objective: 'Reach the audience.', reason: 'This messages people outside your team, so it waits for your approval.' },
      payload: {
        from: 'hello@team.example',
        recipients: n * 5,
        audience: 'past contacts',
        subject: 'You’re invited: join us',
        body: 'Hi,\n\nWe would love to have you. It takes 30 seconds to sign up: forms.example.com/join\n\nThanks!',
      },
      criterion: 'Outreach approved and sent',
    },
    {
      key: 'monitor', type: 'monitor', title: `Monitor ${unit}`, deps: ['send'],
      why: { objective: `Track progress toward ${n}.`, reason: 'The target is the only measure that matters.' },
      out: `Simulated ${unit}: ${n} reached.`, progress: 1,
    },
    {
      key: 'verify', type: 'verify', title: `Verify ${n} ${unit}`, deps: ['monitor'],
      why: { objective: 'Confirm every sign-up is unique and valid.', reason: 'Duplicates inflate the count.' },
    },
  ];
}

function operations(ctx) {
  const docs = /invoice/i.test(ctx.goal) ? 'invoices' : 'documents';
  return [
    {
      key: 'scope', type: 'analyze', title: 'Understand what needs to be done', deps: [],
      why: { objective: 'List every item in scope.', reason: 'Nothing gets missed if the list is complete.' },
      out: `Scope: prepare and send ${docs}, then follow up on anything outstanding.`,
    },
    {
      key: 'records', type: 'browse', title: 'Gather the records', deps: ['scope'],
      why: { objective: 'Collect the data the documents need.', reason: 'Documents are only as accurate as their inputs.' },
      site: 'books.example.com', siteTitle: 'Accounting app (simulated)',
      steps: ['Opened the accounting app', 'Exported this period’s records', 'Matched records to 12 clients'],
      out: 'Pulled records for 12 clients.', fail: true,
    },
    {
      key: 'prepare', type: 'create', title: `Prepare the ${docs}`, deps: ['records'],
      why: { objective: `Produce accurate ${docs}.`, reason: 'Errors here become disputes later.' },
      out: `Prepared 12 ${docs}.`, criterion: `${cap(docs)} prepared`,
    },
    {
      key: 'check', type: 'compare', title: 'Review for errors', deps: ['prepare'],
      why: { objective: 'Catch mistakes before anything is sent.', reason: 'Correcting a sent document costs trust.' },
      out: 'Fixed one wrong rate and a missing PO number.', criterion: 'Reviewed for errors',
    },
    {
      key: 'send', type: 'communicate', title: `Send the ${docs}`, deps: ['check'],
      why: { objective: `Deliver the ${docs} to each client.`, reason: 'This emails clients in your name, so it waits for your approval.' },
      payload: {
        from: 'billing@company.example',
        recipients: 12,
        audience: 'clients',
        subject: `Your ${docs === 'invoices' ? 'invoice' : 'document'} for this period`,
        body: 'Hello,\n\nPlease find this period’s invoice attached. Payment terms are 14 days.\n\nThank you',
      },
      criterion: `${cap(docs)} sent (with approval)`,
    },
    {
      key: 'follow', type: 'monitor', title: 'Follow up on outstanding items', deps: ['send'],
      why: { objective: 'Get everything closed out.', reason: 'Sending is not the same as done.' },
      out: 'Reminders scheduled for 3 overdue accounts (simulated).',
    },
    {
      key: 'verify', type: 'verify', title: 'Verify everything is processed', deps: ['follow'],
      why: { objective: 'Confirm every item is done.', reason: 'Close the loop before calling it finished.' },
    },
  ];
}

function general(ctx) {
  const d = ctx.deliverable;
  return [
    {
      key: 'understand', type: 'analyze', title: 'Understand the goal and define success', deps: [],
      why: { objective: 'Turn the goal into a measurable result.', reason: 'Without a definition of done, no plan can be judged.' },
      out: 'Defined success criteria and the main deliverables for this goal.',
    },
    {
      key: 'context', type: 'research', title: 'Research what the goal requires', deps: ['understand'],
      why: { objective: 'Find constraints, resources and options.', reason: 'Plans built on assumptions break early.' },
      out: 'Identified the key constraints, resources needed and people involved.',
    },
    {
      key: 'plan', type: 'create', title: 'Create an execution plan', deps: ['context'],
      why: { objective: 'Order the work into steps with owners.', reason: 'A plan makes progress visible.' },
      out: 'Broke the work into steps with owners and checkpoints.', criterion: 'Execution plan created',
    },
    {
      key: 'gather', type: 'browse', title: 'Gather the resources needed', deps: ['plan'],
      why: { objective: 'Collect what the deliverables need.', reason: 'Work stalls on missing inputs.' },
      site: 'resources.example.com', siteTitle: 'Resources (simulated)',
      steps: ['Opened the relevant sites and documents', 'Collected the required information', 'Saved everything in one place'],
      out: 'Resources gathered (simulated).', fail: true,
    },
    {
      key: 'deliver', type: 'create', title: d ? `${d.verb} the ${d.object}` : 'Produce the deliverables', deps: ['gather'],
      why: { objective: 'Create what the goal asks for.', reason: 'This is the output everything else supports.' },
      out: d ? `${d.verb === 'Write' ? 'Wrote' : 'Prepared'} the ${d.object} (simulated draft).` : 'Produced the deliverables described in the plan.',
      criterion: d ? `${cap(d.object)} ready` : 'Deliverables produced',
    },
    {
      key: 'review', type: 'compare', title: d ? `Review the ${d.object}` : 'Review the result', deps: ['deliver'],
      why: { objective: 'Check quality before calling it done.', reason: 'A second look catches what the first missed.' },
      out: 'Reviewed the deliverables; tightened two weak sections.', criterion: 'Result reviewed',
    },
    {
      key: 'verify', type: 'verify', title: 'Verify the goal is met', deps: ['review'],
      why: { objective: 'Confirm the result matches the goal.', reason: 'Done means verified.' },
    },
  ];
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const BLUEPRINTS = {
  event_management: event,
  career,
  product_launch: launch,
  research,
  procurement,
  outreach,
  operations,
  general,
};

// Extra approval-gated steps for risky verbs the blueprint did not already cover.
export const RISK_STEPS = {
  communication: {
    type: 'communicate', title: 'Send the update to the people involved',
    payload: { from: 'you@example.com', to: 'People involved', subject: 'Update', body: 'Hi,\n\nHere is the update you asked for.\n\nThanks' },
  },
  publishing: {
    type: 'communicate', title: 'Publish the announcement',
    payload: { from: 'you@example.com', to: 'Your public channels', subject: 'Announcement', body: 'Announcing the update.' },
  },
  submission: {
    type: 'submit', title: 'Submit the prepared forms',
    payload: { from: 'you@example.com', to: 'The receiving organisation', subject: 'Submission', body: 'Please find the completed forms attached.' },
  },
  purchase: {
    type: 'purchase', title: 'Place the order',
    payload: { from: 'you@example.com', to: 'Selected vendor', subject: 'Order', body: 'Please process this order.' },
  },
};
