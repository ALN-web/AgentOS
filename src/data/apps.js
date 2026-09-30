// Catalogue of everyday apps that AgentOS can connect and work with.
// In Demo Mode, this static catalogue provides honest statuses, action permission
// rules, risk tiers, and simulated audit logs without making any network calls.

export const RISK_LEVELS = {
  LOW: {
    level: 'LOW',
    label: 'Low Risk',
    badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    description: 'Read-only access or safe search operations that do not modify external state.',
    allowedModes: ['allowed', 'ask', 'off'],
  },
  MEDIUM: {
    level: 'MEDIUM',
    label: 'Medium Risk',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    description: 'Creates drafts, documents, or safe non-destructive items.',
    allowedModes: ['allowed', 'ask', 'off'],
  },
  HIGH: {
    level: 'HIGH',
    label: 'High Risk',
    badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    description: 'Modifies live calendars, sends external communications, or creates public bookings.',
    // HIGH can never be set to 'allowed' without approval
    allowedModes: ['ask', 'off'],
  },
  CRITICAL: {
    level: 'CRITICAL',
    label: 'Critical Risk',
    badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20',
    description: 'Permanent deletion, bulk mutations, or irreversible transactions.',
    // CRITICAL can never be set to 'allowed' without approval
    allowedModes: ['ask', 'off'],
  },
};

export const PERMISSION_MODES = {
  allowed: {
    id: 'allowed',
    label: 'Allowed',
    title: 'Run automatically',
    description: 'Agent may perform this action without interrupting you.',
  },
  ask: {
    id: 'ask',
    label: 'Ask me',
    title: 'Require approval',
    description: 'Agent pauses and requires your explicit approval before executing.',
  },
  off: {
    id: 'off',
    label: 'Disabled',
    title: 'Do not allow',
    description: 'Agent is forbidden from attempting this action under any circumstance.',
  },
};

export const SCOPE_LABELS = {
  'https://www.googleapis.com/auth/calendar.events': 'Calendar Events',
  'calendar.events': 'Calendar Events',
  'https://www.googleapis.com/auth/gmail.compose': 'Gmail (Draft & Send)',
  'gmail.compose': 'Gmail (Draft & Send)',
  'https://www.googleapis.com/auth/drive.file': 'Drive Files',
  'drive.file': 'Drive Files',
  'https://www.googleapis.com/auth/forms.body': 'Google Forms',
  'forms.body': 'Google Forms',
  'https://www.googleapis.com/auth/forms.responses.readonly': 'Form Responses',
  'forms.responses.readonly': 'Form Responses',
  'openid': 'Account ID',
  'email': 'Account Email',
  'https://www.googleapis.com/auth/userinfo.email': 'Account Email',
};

export function formatScope(scope) {
  if (!scope) return '';
  if (SCOPE_LABELS[scope]) return SCOPE_LABELS[scope];
  const short = scope.split('/').pop();
  return SCOPE_LABELS[short] || short;
}

/**
 * Maps raw backend status to one of the 3 canonical states for Connected Apps (#66):
 * - 'Connected'
 * - 'Not connected'
 * - 'Reconnect'
 *
 * @param {string} rawStatus - Status from /api/integrations or /api/apps
 * @returns {'Connected' | 'Not connected' | 'Reconnect'}
 */
export function toConnectedStatus(rawStatus) {
  if (rawStatus === 'connected') return 'Connected';
  if (rawStatus === 'needs_reconnect') return 'Reconnect';
  return 'Not connected';
}

/**
 * Derives the honest connection status for Google, Gmail, Calendar, Drive, and Forms
 * from /api/integrations and /api/apps without storing or exposing tokens.
 *
 * @param {Array} integrations - Integration list from /api/integrations
 * @param {Array} apps - App list from /api/apps
 * @returns {{ google: string, gmail: string, calendar: string, drive: string, forms: string }}
 */
export function getConnectedServicesStatus(integrations = [], apps = []) {
  const googleInteg = Array.isArray(integrations)
    ? integrations.find((i) => i.provider === 'google')
    : null;

  const findApp = (id) => (Array.isArray(apps) ? apps.find((a) => a.id === id) : null);

  const gmailApp = findApp('gmail');
  const calendarApp = findApp('google-calendar');
  const driveApp = findApp('google-drive');
  const formsApp = findApp('google-forms');

  return {
    google: toConnectedStatus(googleInteg?.status),
    gmail: toConnectedStatus(gmailApp?.status),
    calendar: toConnectedStatus(calendarApp?.status),
    drive: toConnectedStatus(driveApp?.status),
    forms: toConnectedStatus(formsApp?.status),
  };
}

export const APPS_CATALOGUE = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    provider: 'Google',
    category: 'Google Workspace',
    icon: 'Calendar',
    status: 'demo', // 'demo' | 'coming_soon' in demo catalogue; 'connected' | 'available' only in Live mode
    accountEmail: null,
    grantedScopes: [],
    description: 'Schedule meetings, check free/busy availability, and coordinate event timelines across team calendars.',
    disconnectWarning:
      'Disconnecting Google Calendar will revoke calendar event creation and availability checking. Active missions requiring meeting scheduling will pause and require manual intervention.',
    actions: [
      {
        id: 'calendar.read',
        label: 'Read calendar & check availability',
        description: 'Inspect free/busy slots and query existing events to find meeting windows.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'calendar.create_event',
        label: 'Create calendar events',
        description: 'Schedule new calendar appointments and send invitations to attendees.',
        risk: 'MEDIUM',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'calendar.update_event',
        label: 'Reschedule or edit existing events',
        description: 'Modify start times, durations, descriptions, or meeting links for existing events.',
        risk: 'HIGH',
        defaultMode: 'ask',
        mode: 'ask',
      },
      {
        id: 'calendar.delete_event',
        label: 'Delete or cancel calendar events',
        description: 'Remove scheduled events from your calendar and notify participants.',
        risk: 'CRITICAL',
        defaultMode: 'off',
        mode: 'off',
      },
    ],
    activity: [
      {
        id: 'act-gc-1',
        missionId: 'm-hero-1',
        missionGoal: 'Organize team retrospective & schedule calendar invite',
        action: 'calendar.create_event',
        status: 'completed',
        timestamp: '15 mins ago',
        result: 'Scheduled "Q3 Team Retrospective" on Friday at 3:00 PM (8 attendees)',
        evidence: [
          { label: 'Open in Google Calendar', url: 'https://calendar.google.com' },
          { label: 'Audit Proof #GC-4921', url: '#' },
        ],
        simulated: true,
      },
      {
        id: 'act-gc-2',
        missionId: 'm-week-1',
        missionGoal: 'Plan my week around my deadlines',
        action: 'calendar.read',
        status: 'completed',
        timestamp: '2 hours ago',
        result: 'Queried 14 calendar entries across Mon–Fri to identify 6 focus blocks',
        evidence: [{ label: 'Inspect Time Slots', url: '#' }],
        simulated: true,
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    provider: 'Google',
    category: 'Google Workspace',
    icon: 'Mail',
    status: 'demo',
    accountEmail: null,
    grantedScopes: [],
    description: 'Draft and review email communications, monitor confirmation replies, and send updates to verified recipients.',
    disconnectWarning:
      'Disconnecting Gmail prevents AgentOS from drafting emails or dispatching outreach. Outreach missions will stop at the email dispatch step.',
    actions: [
      {
        id: 'gmail.read',
        label: 'Read emails & search threads',
        description: 'Search messages, check for confirmation replies, and parse invoice receipts.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'gmail.create_draft',
        label: 'Create email drafts',
        description: 'Prepare structured email drafts in your Gmail inbox for you to review.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'gmail.send_draft',
        label: 'Send emails on your behalf',
        description: 'Deliver outgoing email to recipients. High risk: always requires your explicit approval.',
        risk: 'HIGH',
        defaultMode: 'ask',
        mode: 'ask',
      },
      {
        id: 'gmail.delete',
        label: 'Permanently delete or trash messages',
        description: 'Trash or delete emails. Critical risk: disabled by default.',
        risk: 'CRITICAL',
        defaultMode: 'off',
        mode: 'off',
      },
    ],
    activity: [
      {
        id: 'act-gm-1',
        missionId: 'm-dinner-1',
        missionGoal: 'Organise a birthday dinner for 8 on Saturday',
        action: 'gmail.create_draft',
        status: 'completed',
        timestamp: '1 hour ago',
        result: 'Created draft: "Birthday Celebration at Osteria Morini — Saturday 7 PM"',
        evidence: [
          { label: 'Open in Gmail Drafts', url: 'https://mail.google.com/mail/u/0/#drafts' },
          { label: 'Audit Proof #GM-8104', url: '#' },
        ],
        simulated: true,
      },
    ],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    provider: 'Google',
    category: 'Google Workspace',
    icon: 'HardDrive',
    status: 'demo',
    accountEmail: null,
    grantedScopes: [],
    description: 'Store research briefs, export structured spreadsheets, and share deliverables directly in your team folders.',
    disconnectWarning:
      'Disconnecting Google Drive stops AgentOS from saving reports and mission deliverables directly to your cloud storage.',
    actions: [
      {
        id: 'drive.search',
        label: 'Search files & read documents',
        description: 'Locate background research briefs, brand guidelines, and shared assets.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'drive.upload',
        label: 'Upload files & export deliverables',
        description: 'Save finalized mission spreadsheets, PDFs, and summaries directly to Google Drive.',
        risk: 'MEDIUM',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'drive.delete',
        label: 'Delete files or move to trash',
        description: 'Remove files from Google Drive. Critical risk: disabled by default.',
        risk: 'CRITICAL',
        defaultMode: 'off',
        mode: 'off',
      },
    ],
    activity: [],
  },
  {
    id: 'google-forms',
    name: 'Google Forms',
    provider: 'Google',
    category: 'Google Workspace',
    icon: 'FileText',
    status: 'demo',
    accountEmail: null,
    grantedScopes: [],
    description: 'Generate registration surveys, RSVP questionnaires, and feedback collection forms with real-time response aggregation.',
    disconnectWarning:
      'Disconnecting Google Forms will pause automated registration pipelines and survey collation.',
    actions: [
      {
        id: 'forms.read_responses',
        label: 'Read form responses & tally results',
        description: 'Fetch real-time RSVP counts and attendee questionnaire answers.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'forms.create',
        label: 'Generate new registration & survey forms',
        description: 'Create customized forms with tailored fields, validation, and theme styling.',
        risk: 'MEDIUM',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
    ],
    activity: [
      {
        id: 'act-gf-1',
        missionId: 'm-hero-1',
        missionGoal: 'Get 100 registrations for our college hackathon',
        action: 'forms.create',
        status: 'completed',
        timestamp: '3 hours ago',
        result: 'Generated registration form: "Hacks 2026 Participant Signup" (12 custom fields)',
        evidence: [
          { label: 'View Google Form', url: 'https://docs.google.com/forms' },
          { label: 'Field Schema Assertion', url: '#' },
        ],
        simulated: true,
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'Slack Technologies',
    category: 'Communication',
    icon: 'MessageSquare',
    status: 'demo',
    accountEmail: null,
    grantedScopes: [],
    description: 'Publish sprint summaries, broadcast milestone alerts, and ping team channels when manual approvals are waiting.',
    disconnectWarning:
      'Disconnecting Slack will prevent AgentOS from sending notifications and summaries to your team channels.',
    actions: [
      {
        id: 'slack.read_channels',
        label: 'Read public channel messages',
        description: 'Read thread context, questions, and mentions in authorized channels.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'slack.post_message',
        label: 'Post messages & updates to channels',
        description: 'Broadcast completed summaries, sprint charts, and mission outcomes.',
        risk: 'MEDIUM',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'slack.admin',
        label: 'Manage channels, user invites & permissions',
        description: 'Create channels or invite members. High risk: requires approval.',
        risk: 'HIGH',
        defaultMode: 'ask',
        mode: 'ask',
      },
    ],
    activity: [
      {
        id: 'act-sl-1',
        missionId: 'm-hackathon-1',
        missionGoal: 'Organize a hackathon for 100 students in my college',
        action: 'slack.post_message',
        status: 'completed',
        timestamp: '5 hours ago',
        result: 'Posted briefing update to #announcements (100 students notified)',
        evidence: [{ label: 'View Channel Message', url: 'https://slack.com' }],
        simulated: true,
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    provider: 'Meta',
    category: 'Communication',
    icon: 'PhoneCall',
    status: 'demo',
    accountEmail: null,
    grantedScopes: [],
    description: 'Send urgent operational alerts, RSVP confirmation pings, and emergency reschedule notifications directly to mobile contacts.',
    disconnectWarning:
      'Disconnecting WhatsApp stops mobile messaging alerts and emergency vendor notifications.',
    actions: [
      {
        id: 'whatsapp.read_messages',
        label: 'Read incoming messages & acknowledgments',
        description: 'Inspect replies and yes/no confirmations from contacted vendors or attendees.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'whatsapp.send_message',
        label: 'Send direct messages to contacts',
        description: 'Send messages to phone numbers. High risk: always requires confirmation.',
        risk: 'HIGH',
        defaultMode: 'ask',
        mode: 'ask',
      },
    ],
    activity: [
      {
        id: 'act-wa-1',
        missionId: 'm-rescue-1',
        missionGoal: 'Handle urgent venue reschedule notification',
        action: 'whatsapp.send_message',
        status: 'completed',
        timestamp: 'Yesterday',
        result: 'Dispatched emergency reschedule notification to venue point-of-contact',
        evidence: [{ label: 'Audit Log #WA-9014', url: '#' }],
        simulated: true,
      },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    provider: 'Notion Labs',
    category: 'Productivity',
    icon: 'BookOpen',
    status: 'demo',
    accountEmail: null,
    grantedScopes: [],
    description: 'Build structured project wikis, maintain internship candidate shortlists, and publish knowledge bases with rich formatting.',
    disconnectWarning:
      'Disconnecting Notion stops AgentOS from writing pages and synchronizing task databases.',
    actions: [
      {
        id: 'notion.search',
        label: 'Search workspace & read pages',
        description: 'Query company wikis, style guides, and team documentation.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'notion.create_page',
        label: 'Create pages & database items',
        description: 'Generate formatted research dossiers, meeting summaries, and tables.',
        risk: 'MEDIUM',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'notion.update_database',
        label: 'Update database schemas & bulk records',
        description: 'Modify structured table properties. High risk: requires approval.',
        risk: 'HIGH',
        defaultMode: 'ask',
        mode: 'ask',
      },
    ],
    activity: [],
  },
  {
    id: 'discord',
    name: 'Discord',
    provider: 'Discord Inc.',
    category: 'Communication',
    icon: 'Radio',
    status: 'coming_soon',
    accountEmail: null,
    grantedScopes: [],
    description: 'Community moderation, automated announcement bot integration, and developer support ticket triage.',
    disconnectWarning: null,
    actions: [
      {
        id: 'discord.read_channels',
        label: 'Read community channels',
        description: 'Monitor questions and support threads.',
        risk: 'LOW',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
      {
        id: 'discord.post_announcement',
        label: 'Post community announcements',
        description: 'Send broadcasts to general or announcement channels.',
        risk: 'MEDIUM',
        defaultMode: 'allowed',
        mode: 'allowed',
      },
    ],
    activity: [],
  },
];
