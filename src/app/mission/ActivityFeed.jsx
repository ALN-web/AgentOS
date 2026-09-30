import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  GitBranch,
  MessagesSquare,
  PenLine,
  RotateCcw,
  ShieldAlert,
  XCircle,
  Zap,
  Calendar,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { AgentIcon, EmptyState, agentName, formatClock, formatTime } from '../../components/ui';
import { AppBadge, appForEvent } from '../../components/AppIcon';
import { AGENT_BY_ID } from '../../data/agents';

const TYPE = {
  plan: { tag: 'Plan', icon: GitBranch, cls: 'text-violet-300 border-violet-400/25 bg-violet-400/10' },
  action: { tag: 'Action', icon: Check, cls: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10' },
  critique: { tag: 'Review', icon: PenLine, cls: 'text-pink-300 border-pink-400/25 bg-pink-400/10' },
  failure: { tag: 'Failure', icon: XCircle, cls: 'text-red-300 border-red-400/30 bg-red-400/10' },
  recovery: { tag: 'Recovery', icon: RotateCcw, cls: 'text-[#ff9a5c] border-[#eb6920]/30 bg-[#eb6920]/10' },
  recovered: { tag: 'Recovered', icon: CheckCircle2, cls: 'text-[#ff9a5c] border-[#eb6920]/40 bg-[#eb6920]/15' },
  approval: { tag: 'Approval', icon: ShieldAlert, cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10' },
  verified: { tag: 'Verified', icon: BadgeCheck, cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
  complete: { tag: 'Complete', icon: Flag, cls: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/15' },
  system: { tag: 'System', icon: Zap, cls: 'text-gray-400 border-white/10 bg-white/[0.04]' },
};

const ROW = {
  failure: 'border-red-500/30 bg-red-500/[0.06]',
  recovery: 'border-[#eb6920]/25 bg-[#eb6920]/[0.04]',
  recovered: 'border-[#eb6920]/45 bg-[#eb6920]/[0.08]',
  approval: 'border-amber-400/25 bg-amber-400/[0.04]',
  verified: 'border-emerald-500/25 bg-emerald-500/[0.05]',
  complete: 'border-emerald-500/40 bg-emerald-500/[0.08]',
};

export default function ActivityFeed({ events, tasks = [], isLive = false, onSelect, selectedId }) {
  const scroller = useRef(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <EmptyState icon={MessagesSquare} title="No activity yet" className="h-full">
        Agent messages and actions appear here as the mission runs.
      </EmptyState>
    );
  }

  return (
    <ol ref={scroller} className="h-full overflow-y-auto pr-1 relative" aria-label="Agent activity timeline">
      {events.map((e, i) => {
        const agent = AGENT_BY_ID[e.agent];
        const color = agent?.color || '#9ca3af';
        const type = TYPE[e.type];
        const TypeIcon = type?.icon;
        const last = i === events.length - 1;
        const selected = e.id === selectedId;
        const Row = onSelect ? 'button' : 'div';
        const appId = appForEvent(e, tasks);

        return (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-[64px_20px_minmax(0,1fr)] sm:grid-cols-[76px_24px_minmax(0,1fr)] gap-x-2"
          >
            {/* Time */}
            <div className="pt-3 text-right">
              <div className="text-[10px] sm:text-[11px] font-mono text-gray-400 tabular-nums">{formatTime(e.at)}</div>
              <div className="text-[9px] font-mono text-gray-600 tabular-nums">T+{formatClock(e.t)}</div>
            </div>

            {/* Rail */}
            <div className="relative flex justify-center">
              <span className={`absolute top-0 w-px bg-white/[0.08] ${last ? 'h-4' : 'bottom-0'}`} />
              <span
                className="relative mt-3.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#0e0c12]"
                style={{ background: color, boxShadow: last ? `0 0 10px ${color}` : 'none' }}
              />
            </div>

            {/* Event */}
            <div className="pb-2">
              <Row
                {...(onSelect ? { type: 'button', onClick: () => onSelect(e), 'aria-label': `Explain: ${e.text}` } : {})}
                className={`group w-full text-left flex gap-3 p-3 rounded-xl border transition-colors ${ROW[e.type] || 'border-white/5 bg-white/[0.02]'} ${
                  onSelect ? 'hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6920]/60' : ''
                } ${selected ? '!border-[#eb6920]/60' : ''}`}
              >
                <AgentIcon id={e.agent} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 min-w-0 flex-wrap">
                    <span className="text-[11px] font-semibold truncate" style={{ color }}>
                      {agentName(e.agent)}
                    </span>
                    {type && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider shrink-0 ${type.cls}`}>
                        <TypeIcon className="w-2.5 h-2.5" />
                        {isLive && type.tag === 'Action' ? 'LIVE · ' + type.tag : type.tag}
                      </span>
                    )}
                    {appId && (
                      <AppBadge appId={appId} size="sm" />
                    )}
                    {onSelect && (
                      <span className="ml-auto hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-600 group-hover:text-[#eb6920] transition-colors shrink-0">
                        Why?
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-200 leading-relaxed">{e.text}</p>
                  {e.evidence && e.evidence.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5" onClick={(evt) => evt.stopPropagation()}>
                      {e.evidence.map((ev, idx) => {
                        const isCalendar = (ev.url && ev.url.includes('calendar.google.com')) || ev.source === 'google_calendar';
                        const isGmail = (ev.url && ev.url.includes('mail.google.com')) || ev.source === 'gmail';
                        const label = ev.label || (isCalendar ? 'Open in Google Calendar' : isGmail ? 'Open in Gmail' : 'View Proof');

                        return ev.url ? (
                          <a
                            key={idx}
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#eb6920]/40 bg-[#eb6920]/10 hover:bg-[#eb6920]/20 text-[#ff9a5c] hover:text-white text-[11px] font-semibold transition-all shadow-sm"
                          >
                            {isCalendar ? (
                              <Calendar className="w-3 h-3 text-[#eb6920]" />
                            ) : isGmail ? (
                              <Mail className="w-3 h-3 text-[#eb6920]" />
                            ) : (
                              <ExternalLink className="w-3 h-3 text-[#eb6920]" />
                            )}
                            <span>{label}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                          </a>
                        ) : (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-white/10 bg-white/5 text-[11px] text-gray-300 font-medium"
                          >
                            <BadgeCheck className="w-3 h-3 text-emerald-400" />
                            <span>{label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Row>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
