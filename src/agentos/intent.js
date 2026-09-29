// Goal understanding: free text -> a structured Mission Intent.
//
// Demo Mode uses deterministic heuristics (keyword scoring and pattern
// extraction). A live implementation would ask an LLM for the same shape; the
// rest of AgentOS only depends on the MissionIntent structure, not on how it
// was produced.
//
// MissionIntent = {
//   goal, objective, domain, domainLabel, desiredOutcome,
//   quantity: { n, unit } | null, date, format, constraints[], entities[],
//   risks[], requiredCapabilities[], questions[], assumptions[], answers
// }

// Broad domains, not specific problems. Each keyword carries a weight; the
// best-scoring domain wins, and anything unmatched falls back to 'general'.
const DOMAINS = {
  event_management: {
    label: 'Event management',
    words: {
      hackathon: 3, workshop: 3, meetup: 3, conference: 3, seminar: 3, webinar: 3, fest: 3, festival: 3, summit: 3,
      bootcamp: 3, competition: 2, contest: 2, ceremony: 3, party: 2, offsite: 3, orientation: 2, event: 2, outing: 2,
      organize: 1, organise: 1, host: 1, venue: 2,
    },
  },
  career: {
    label: 'Career',
    words: { internship: 3, internships: 3, job: 3, jobs: 3, career: 3, resume: 3, cv: 3, openings: 2, apply: 1, position: 1, positions: 1 },
  },
  product_launch: {
    label: 'Product launch',
    words: { launch: 3, release: 2, 'go-to-market': 3, gtm: 3, product: 1, ship: 1 },
  },
  research: {
    label: 'Research',
    words: { research: 3, competitor: 3, competitors: 3, compare: 2, analysis: 2, analyze: 2, analyse: 2, study: 2, market: 1, investigate: 3, report: 1 },
  },
  procurement: {
    label: 'Procurement',
    words: { buy: 3, purchase: 3, quote: 3, quotes: 3, vendor: 3, vendors: 3, supplier: 3, procure: 3, order: 2, laptop: 2, laptops: 2, monitors: 2, equipment: 2, price: 1 },
  },
  outreach: {
    label: 'Growth & outreach',
    words: {
      registrations: 3, 'sign-ups': 3, signups: 3, subscribers: 3, followers: 3, leads: 3, users: 2, attendees: 2,
      promote: 2, campaign: 3, marketing: 2, outreach: 3,
    },
  },
  operations: {
    label: 'Operations',
    words: { invoice: 3, invoices: 3, billing: 3, payments: 2, overdue: 3, expenses: 3, payroll: 3, onboarding: 3, onboard: 3, reconcile: 3, paperwork: 2 },
  },
};

// Verbs that reach outside the system. Any of these makes an approval point.
const RISKS = [
  { id: 'communication', label: 'Sends messages to people', words: /\b(email|e-mail|mail|send|invite|message|notify|remind|chase|contact|reach out)\b/i },
  { id: 'publishing', label: 'Publishes content', words: /\b(publish|post|announce|promote|advertise|tweet)\b/i },
  { id: 'submission', label: 'Submits forms or applications', words: /\b(apply|submit|file|enrol|enroll)\b/i },
  { id: 'purchase', label: 'Spends money or books', words: /\b(buy|purchase|order|pay|book|reserve|subscribe)\b/i },
  { id: 'destructive', label: 'Deletes or cancels', words: /\b(delete|remove|cancel|close account|unsubscribe)\b/i },
];

const STOP = new Set(['for', 'to', 'and', 'in', 'under', 'by', 'next', 'from', 'at', 'with', 'the', 'our', 'my', 'of', 'on', 'each', 'who', 'that', 'which', 'this', 'a', 'an', 'per', 'suitable', 'relevant', 'matching', 'available', 'near', 'open', 'before', 'within', 'or']);
const LEADING_ADJ = new Set(['suitable', 'relevant', 'matching', 'available', 'open', 'new', 'good', 'great', 'qualified', 'verified', 'paid', 'unpaid', 'remote', 'local', 'real', 'unique', 'active']);
const PRIMARY_UNIT = {
  career: /intern|job|opening|opportunit|position|role|compan/i,
  event_management: /student|participant|people|attendee|registration|guest|team/i,
  outreach: /registration|sign|user|lead|follower|subscriber|attendee|customer/i,
  procurement: /^(?!quote|vendor|option|supplier)/i,
};

const EVENT_WORDS = ['hackathon', 'workshop', 'meetup', 'conference', 'seminar', 'webinar', 'festival', 'fest', 'summit', 'bootcamp', 'competition', 'contest', 'ceremony', 'party', 'offsite', 'orientation', 'outing'];
const PLACES = ['college', 'university', 'campus', 'school', 'office', 'company', 'club', 'team', 'community', 'department'];

const words = (text) => text.toLowerCase().match(/[a-z][a-z-]*/g) || [];

export function classifyDomain(goal) {
  const tokens = words(goal);
  let best = { id: 'general', score: 0 };
  for (const [id, d] of Object.entries(DOMAINS)) {
    const score = tokens.reduce((n, t) => n + (d.words[t] || 0), 0);
    if (score > best.score) best = { id, score };
  }
  return best.id;
}

// Numbers followed by what they count: "100 registrations", "20 office monitors".
export function extractQuantities(goal) {
  const out = [];
  const re = /(^|[^$\d.,])(\d[\d,]*)\s+([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,3})/gi;
  let match;
  while ((match = re.exec(goal))) {
    const n = parseInt(match[2].replace(/,/g, ''), 10);
    const original = match[3].split(/\s+/);
    // "20 suitable internship opportunities": skip leading adjectives, then
    // stop at the first word that ends the noun phrase.
    let start = 0;
    while (start < original.length - 1 && LEADING_ADJ.has(original[start].toLowerCase())) start++;
    const unitWords = [];
    for (const w of original.slice(start)) {
      if (STOP.has(w.toLowerCase())) break;
      unitWords.push(w);
    }
    if (n > 0 && unitWords.length) out.push({ n, unit: unitWords.join(' ') });
  }
  return out;
}

function pickQuantity(domain, quantities) {
  const test = PRIMARY_UNIT[domain];
  return (test && quantities.find((q) => test.test(q.unit))) || quantities[0] || null;
}

function extractDate(goal) {
  const m =
    goal.match(/\b(?:next|this)\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i) ||
    goal.match(/\b(?:next|this)\s+(?:week|month|quarter|semester)\b/i) ||
    goal.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/i) ||
    goal.match(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i) ||
    goal.match(/\b(?:tomorrow|today|tonight)\b/i) ||
    goal.match(/\bby\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i);
  return m ? m[0] : null;
}

function extractFormat(goal) {
  if (/\bhybrid\b/i.test(goal)) return 'hybrid';
  if (/\b(online|virtual|remote|zoom|webinar)\b/i.test(goal)) return 'online';
  if (/\b(in-person|in person|offline|on campus|on-site|onsite|venue)\b/i.test(goal)) return 'in person';
  if (/\bin (?:our|the|my) (?:college|university|campus|school|office)\b/i.test(goal)) return 'in person';
  return null;
}

function extractConstraints(goal) {
  const out = [];
  const budget = goal.match(/\b(?:under|below|less than|max(?:imum)?|within|budget of)\s+\$?\s?\d[\d,]*(?:\s?k)?(?:\s+each)?/i) || goal.match(/\$\d[\d,]*(?:\s?k)?(?:\s+each)?/);
  if (budget) out.push(`Budget: ${budget[0].trim()}`);
  const best = goal.match(/\b(?:best|top)\s+(\d+)\b/i);
  if (best) out.push(`Focus on the top ${best[1]}`);
  const where = goal.match(/\b(?:in|near|around)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  if (where) out.push(`Location: ${where[1]}`);
  return out;
}

// "Write a newsletter about ..." -> { verb: 'Write', object: 'newsletter' }
const MAKE = /\b(write|create|draft|design|make|build|prepare|produce|compile|plan)\s+(?:a|an|the|our|my|some)?\s*([a-z][a-z-]*(?:\s+[a-z][a-z-]*)?)/i;
const OBJECT_STOP = /\s+(about|for|on|to|with|that|and|of|in|by)\b.*$/i;
function extractDeliverable(goal) {
  const m = goal.match(MAKE);
  if (!m) return null;
  const object = m[2].replace(OBJECT_STOP, '').trim().toLowerCase();
  if (!object || STOP.has(object.split(' ')[0])) return null;
  return { verb: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), object };
}

// "... and email it to all staff" -> 'all staff'
function extractRecipient(goal) {
  const m = goal.match(/\b(?:email|e-mail|send|share|mail|message|forward|present)\b[^.]*?\bto\s+((?:all|the|our|my|every)\s+[a-z]+(?:\s[a-z]+)?|everyone|[a-z]+\s+team)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function eventNoun(goal) {
  const tokens = words(goal);
  return EVENT_WORDS.find((w) => tokens.includes(w)) || 'event';
}

const cleanGoal = (goal) =>
  goal
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!]+$/, '');

// The objective in imperative form: strips "please", "help me", "we need to", etc.
function objectiveOf(goal) {
  let text = cleanGoal(goal)
    .replace(/^(?:please\s+|can you\s+|could you\s+|i want to\s+|i need to\s+|we need to\s+|we want to\s+|help me\s+(?:to\s+)?|help us\s+(?:to\s+)?)/i, '')
    .replace(/^we are (?:organising|organizing|planning|hosting|running) (?:an? |the )?(.+?)(?:\.\s*| - )(?:organi[sz]e|plan|handle) everything.*$/i, 'Organize the $1');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Critical details worth asking for, per domain. Only asked when missing.
function questionsFor(domain, ctx) {
  const q = [];
  if (domain === 'event_management') {
    if (!ctx.quantity) q.push({ id: 'participants', question: 'How many participants do you expect?', placeholder: 'e.g. 150' });
    if (!ctx.date) q.push({ id: 'date', question: 'When is it?', placeholder: 'e.g. Nov 14' });
    if (!ctx.format) q.push({ id: 'format', question: 'Online, in person, or hybrid?', options: ['In person', 'Online', 'Hybrid'] });
  } else if (domain === 'career') {
    if (!ctx.quantity) q.push({ id: 'count', question: 'How many opportunities should I find?', placeholder: 'e.g. 20' });
    if (!/\b(ai|ml|software|data|design|marketing|finance|product|research|web|mobile|cloud|security|hardware|business|sales)\b/i.test(ctx.goal))
      q.push({ id: 'field', question: 'Which field or role?', placeholder: 'e.g. machine learning' });
    if (!/\b(remote|in\s+[A-Z])/.test(ctx.goal)) q.push({ id: 'location', question: 'Remote, or a specific city?', placeholder: 'e.g. Remote or Bengaluru' });
  } else if (domain === 'procurement') {
    if (!ctx.constraints.some((c) => c.startsWith('Budget'))) q.push({ id: 'budget', question: 'What is the budget?', placeholder: 'e.g. under $250 each' });
    if (!ctx.quantity) q.push({ id: 'count', question: 'How many do you need?', placeholder: 'e.g. 20' });
  } else if (domain === 'product_launch') {
    if (!ctx.date) q.push({ id: 'date', question: 'What is the launch date?', placeholder: 'e.g. next Tuesday' });
  } else if (domain === 'outreach') {
    if (!ctx.quantity) q.push({ id: 'count', question: 'What number are you aiming for?', placeholder: 'e.g. 100 sign-ups' });
    if (!ctx.date) q.push({ id: 'date', question: 'By when?', placeholder: 'e.g. Friday' });
  }
  return q.slice(0, 3);
}

function applyAnswers(ctx, answers, domain) {
  const a = answers || {};
  const num = (v) => {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  if (a.participants && num(a.participants)) ctx.quantity = { n: num(a.participants), unit: 'participants' };
  if (a.count && num(a.count)) {
    const unit = domain === 'career' ? 'opportunities' : domain === 'outreach' ? String(a.count).replace(/[\d,\s]+/, '').trim() || 'sign-ups' : 'units';
    ctx.quantity = { n: num(a.count), unit };
  }
  if (a.date && String(a.date).trim()) ctx.date = String(a.date).trim();
  if (a.format) ctx.format = String(a.format).toLowerCase();
  if (a.budget && String(a.budget).trim()) ctx.constraints = [...ctx.constraints.filter((c) => !c.startsWith('Budget')), `Budget: ${String(a.budget).trim()}`];
  if (a.field && String(a.field).trim()) ctx.constraints = [...ctx.constraints, `Field: ${String(a.field).trim()}`];
  if (a.location && String(a.location).trim()) ctx.constraints = [...ctx.constraints, `Location: ${String(a.location).trim()}`];
}

// Sensible defaults for anything still unknown, stated openly.
function assume(ctx, domain) {
  const out = [];
  if (domain === 'event_management') {
    if (!ctx.quantity) {
      ctx.quantity = { n: 100, unit: 'participants' };
      out.push('About 100 participants');
    }
    if (!ctx.date) out.push('A date about six weeks from now');
    if (!ctx.format) {
      ctx.format = 'in person';
      out.push('An in-person event');
    }
  }
  if (domain === 'career' && !ctx.quantity) {
    ctx.quantity = { n: 10, unit: 'opportunities' };
    out.push('10 opportunities is enough to choose from');
  }
  if (domain === 'procurement' && !ctx.constraints.some((c) => c.startsWith('Budget'))) out.push('No budget limit: options are compared on value');
  if (domain === 'product_launch' && !ctx.date) out.push('Launch in about two weeks');
  if (domain === 'outreach' && !ctx.quantity) {
    ctx.quantity = { n: 100, unit: 'sign-ups' };
    out.push('A target of 100 sign-ups');
  }
  if (domain === 'general') out.push('Real-world actions are simulated in Demo Mode');
  return out;
}

function desiredOutcome(domain, ctx) {
  const q = ctx.quantity;
  switch (domain) {
    case 'event_management':
      return `${cap(ctx.eventNoun)} ready to run${q ? ` for ${q.n} ${q.unit}` : ''}`;
    case 'career':
      return `${q.n} verified ${q.unit}`;
    case 'procurement':
      return `${q ? `${q.n} ${q.unit}` : 'Options'} that meet the requirements, with quotes`;
    case 'product_launch':
      return `Launch ready${ctx.date ? ` for ${ctx.date}` : ''}`;
    case 'research':
      return 'A verified report with sources';
    case 'outreach':
      return `${q.n} verified ${q.unit}`;
    case 'operations':
      return 'Every item processed and confirmed';
    default:
      return 'Goal completed and verified';
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const DOMAIN_CAPABILITIES = {
  event_management: ['planning', 'research', 'document', 'browser', 'communication', 'monitoring', 'verification'],
  career: ['planning', 'search', 'analysis', 'research', 'document', 'verification'],
  product_launch: ['planning', 'research', 'document', 'browser', 'communication', 'monitoring', 'verification'],
  research: ['planning', 'search', 'browser', 'analysis', 'document', 'verification'],
  procurement: ['planning', 'search', 'analysis', 'communication', 'verification'],
  outreach: ['planning', 'research', 'browser', 'communication', 'monitoring', 'verification'],
  operations: ['planning', 'research', 'document', 'analysis', 'communication', 'monitoring', 'verification'],
  general: ['planning', 'research', 'browser', 'document', 'analysis', 'verification'],
};

const RISK_CAPABILITY = { communication: 'communication', publishing: 'communication', submission: 'submission', purchase: 'purchasing', destructive: 'browser' };

export function analyzeGoal(goal, answers = {}) {
  const text = cleanGoal(goal);
  const domain = classifyDomain(text);
  const quantities = extractQuantities(text);
  const ctx = {
    goal: text,
    quantity: pickQuantity(domain, quantities),
    date: extractDate(text),
    format: extractFormat(text),
    constraints: extractConstraints(text),
    eventNoun: eventNoun(text),
  };

  const questions = questionsFor(domain, ctx).filter((q) => !(answers[q.id] && String(answers[q.id]).trim()));
  applyAnswers(ctx, answers, domain);
  const assumptions = assume(ctx, domain);

  const risks = RISKS.filter((r) => r.words.test(text)).map(({ id, label }) => ({ id, label }));
  const tokens = words(text);
  const entities = [...new Set([...tokens.filter((t) => EVENT_WORDS.includes(t) || PLACES.includes(t)), ...Object.keys(DOMAINS[domain]?.words || {}).filter((w) => tokens.includes(w) && w.length > 3)])];
  const requiredCapabilities = [...new Set([...DOMAIN_CAPABILITIES[domain], ...risks.map((r) => RISK_CAPABILITY[r.id])])];

  return {
    goal: text,
    objective: objectiveOf(text),
    domain,
    domainLabel: DOMAINS[domain]?.label || 'General',
    desiredOutcome: desiredOutcome(domain, ctx),
    quantity: ctx.quantity,
    date: ctx.date,
    format: ctx.format,
    eventNoun: ctx.eventNoun,
    deliverable: extractDeliverable(text),
    recipient: extractRecipient(text),
    constraints: ctx.constraints,
    entities,
    risks,
    requiredCapabilities,
    questions,
    assumptions,
    answers,
  };
}
