import React from 'react';
import { Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { AGENT_BY_ID } from '../data/agents';

// The one status vocabulary used across the product.
export const STATUS_META = {
  planning: { label: 'Planning', dot: 'bg-violet-400', text: 'text-violet-300', ring: 'border-violet-400/30 bg-violet-400/10', pulse: true },
  running: { label: 'Running', dot: 'bg-[#eb6920]', text: 'text-[#ff9a5c]', ring: 'border-[#eb6920]/30 bg-[#eb6920]/10', pulse: true },
  awaiting_approval: { label: 'Awaiting Approval', dot: 'bg-amber-400', text: 'text-amber-300', ring: 'border-amber-400/30 bg-amber-400/10', pulse: true },
  recovering: { label: 'Recovering', dot: 'bg-red-400', text: 'text-red-300', ring: 'border-red-400/30 bg-red-400/10', pulse: true },
  completed: { label: 'Completed', dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'border-emerald-400/30 bg-emerald-400/10' },
};

export function StatusPill({ status, paused }) {
  const meta = STATUS_META[status] || STATUS_META.running;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap ${meta.ring} ${meta.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${meta.pulse && !paused ? 'animate-pulse' : ''}`} />
      {paused ? 'Paused' : meta.label}
    </span>
  );
}

export function AgentIcon({ id, size = 'md' }) {
  const agent = AGENT_BY_ID[id];
  const Icon = agent?.icon || Bot;
  const box = size === 'sm' ? 'w-6 h-6 rounded-lg' : size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-xl';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const color = agent?.color || '#9ca3af';
  return (
    <span
      className={`${box} shrink-0 inline-flex items-center justify-center border`}
      style={{ color, background: `${color}14`, borderColor: `${color}33` }}
    >
      <Icon className={icon} />
    </span>
  );
}

export function agentName(id) {
  return id === 'system' ? 'AgentOS' : `${AGENT_BY_ID[id]?.name || id} Agent`;
}

export function ProgressRing({ value, target, size = 120, stroke = 8, children }) {
  const pct = Math.max(0, Math.min(1, target ? value / target : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct >= 1 ? '#34d399' : '#eb6920'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1), stroke 0.4s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, target }) {
  const pct = Math.max(0, Math.min(100, target ? (value / target) * 100 : 0));
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-[#ff8c42] to-[#eb6920]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Logo({ to = '/', size = 'md', className = '' }) {
  const sizeMap = {
    xs: 'h-7 w-7 rounded-lg',
    sm: 'h-9 w-9 rounded-xl',
    md: 'h-12 w-12 rounded-2xl',
    lg: 'h-14 w-14 rounded-2xl',
  };
  const dimensions = sizeMap[size] || sizeMap.md;
  return (
    <Link to={to} className={`inline-flex items-center group ${className}`} aria-label="AgentOS">
      <img
        src="/assets/agentos-logo.jpeg"
        alt="AgentOS"
        className={`${dimensions} object-contain shadow-[0_0_18px_rgba(235,105,32,0.28)] group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(235,105,32,0.5)] transition-all duration-200`}
      />
    </Link>
  );
}

export function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-semibold uppercase tracking-wider text-[#eb6920] mb-4">
      {Icon && <Icon className="w-3 h-3" />}
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
      {Icon && (
        <span className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-gray-500 mb-3">
          <Icon className="w-5 h-5" />
        </span>
      )}
      <div className="text-sm font-semibold text-white">{title}</div>
      {children && <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function formatTime(ts) {
  if (!ts) return '--:--:--';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function formatDuration(ms) {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function timeAgo(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  if (diff < 45_000) return 'just now';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
