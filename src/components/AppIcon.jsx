import React from 'react';
import {
  Calendar,
  Mail,
  HardDrive,
  FileText,
  MessageSquare,
  Code,
  Radio,
  PhoneCall,
  Globe,
  AppWindow,
} from 'lucide-react';

export const APP_METAS = {
  'google-calendar': {
    id: 'google-calendar',
    name: 'Google Calendar',
    shortName: 'Calendar',
    provider: 'Google Workspace',
    icon: Calendar,
    color: '#eb6920',
    bg: 'bg-[#eb6920]/10',
    border: 'border-[#eb6920]/25',
    text: 'text-[#ff9a5c]',
  },
  'gmail': {
    id: 'gmail',
    name: 'Gmail',
    shortName: 'Gmail',
    provider: 'Google Workspace',
    icon: Mail,
    color: '#ea4335',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    text: 'text-red-400',
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    shortName: 'Drive',
    provider: 'Google Workspace',
    icon: HardDrive,
    color: '#34a853',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    text: 'text-emerald-400',
  },
  'slack': {
    id: 'slack',
    name: 'Slack',
    shortName: 'Slack',
    provider: 'Slack Technologies',
    icon: MessageSquare,
    color: '#e01e5a',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    text: 'text-purple-300',
  },
  'notion': {
    id: 'notion',
    name: 'Notion',
    shortName: 'Notion',
    provider: 'Notion Labs',
    icon: FileText,
    color: '#ffffff',
    bg: 'bg-white/10',
    border: 'border-white/20',
    text: 'text-white',
  },
  'github': {
    id: 'github',
    name: 'GitHub',
    shortName: 'GitHub',
    provider: 'GitHub Inc.',
    icon: Code,
    color: '#6e40c9',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    text: 'text-violet-300',
  },
  'discord': {
    id: 'discord',
    name: 'Discord',
    shortName: 'Discord',
    provider: 'Discord Inc.',
    icon: Radio,
    color: '#5865f2',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    text: 'text-indigo-300',
  },
};

export function normalizeAppId(rawId) {
  if (!rawId) return null;
  const s = String(rawId).toLowerCase().trim();
  if (s === 'google_calendar' || s === 'google-calendar' || s === 'calendar') return 'google-calendar';
  if (s === 'gmail' || s === 'email' || s === 'inbox') return 'gmail';
  if (s === 'google_drive' || s === 'google-drive' || s === 'drive') return 'google-drive';
  if (s === 'slack') return 'slack';
  if (s === 'notion') return 'notion';
  if (s === 'github') return 'github';
  if (s === 'discord') return 'discord';
  return s;
}

export function getAppMeta(id) {
  const norm = normalizeAppId(id);
  return APP_METAS[norm] || null;
}

export function appForTask(task) {
  if (!task) return null;
  if (task.appId) return normalizeAppId(task.appId);
  if (task.app) return normalizeAppId(task.app);
  if (task.tool) {
    if (task.tool.startsWith('calendar')) return 'google-calendar';
    if (task.tool.startsWith('gmail')) return 'gmail';
    if (task.tool.startsWith('drive')) return 'google-drive';
    if (task.tool.startsWith('slack')) return 'slack';
    if (task.tool.startsWith('notion')) return 'notion';
  }
  if (task.capability === 'calendar' || task.type === 'schedule') return 'google-calendar';
  if (task.capability === 'email' || task.type === 'inbox' || task.type === 'email') return 'gmail';
  if (task.capability === 'reminders' || task.type === 'remind') return 'google-calendar';

  const title = (task.title || '').toLowerCase();
  if (title.includes('calendar') || title.includes('meeting slot') || title.includes('free time') || title.includes('suitable time') || title.includes('focus time')) {
    return 'google-calendar';
  }
  if (title.includes('invite') || title.includes('email') || title.includes('inbox') || (task.payload && (task.payload.to || task.payload.subject))) {
    return 'gmail';
  }
  if (title.includes('drive') || title.includes('doc ') || title.includes('spreadsheet')) {
    return 'google-drive';
  }
  if (title.includes('slack')) return 'slack';
  if (title.includes('notion')) return 'notion';

  return null;
}

export function appForEvent(e, tasks = []) {
  if (!e) return null;
  if (e.app) return normalizeAppId(e.app);
  if (e.appId) return normalizeAppId(e.appId);
  if (e.taskId) {
    const t = tasks.find((x) => x.id === e.taskId);
    if (t) return appForTask(t);
  }
  const inFlight = tasks.find(
    (t) => t.agent === e.agent && t.startedAt != null && t.startedAt <= e.t && (t.finishedAt == null || t.finishedAt >= e.t)
  );
  if (inFlight) {
    const app = appForTask(inFlight);
    if (app) return app;
  }
  const text = (e.text || '').toLowerCase();
  if (text.includes('calendar') || text.includes('meeting slot') || text.includes('dinner time') || text.includes('scheduled')) {
    return 'google-calendar';
  }
  if (text.includes('gmail') || text.includes('invite') || text.includes('sent email') || text.includes('drafted email')) {
    return 'gmail';
  }
  if (text.includes('google drive') || text.includes('document') || text.includes('drive folder')) {
    return 'google-drive';
  }
  return null;
}

export function AppIcon({ appId, className = 'w-3.5 h-3.5' }) {
  const meta = getAppMeta(appId);
  const Icon = meta?.icon || AppWindow;
  return <Icon className={className} />;
}

export function AppBadge({ appId, size = 'sm', showName = true, className = '' }) {
  const meta = getAppMeta(appId);
  if (!meta) return null;
  const Icon = meta.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border shrink-0 ${
        isSm ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'
      } ${meta.bg} ${meta.border} ${meta.text} ${className}`}
      title={`${meta.name} (${meta.provider})`}
    >
      <Icon className={isSm ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      {showName && <span>{meta.shortName}</span>}
    </span>
  );
}
