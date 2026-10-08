import React from 'react';
import { Check, Globe, Lock, MousePointerClick, X } from 'lucide-react';
import { EmptyState, formatClock } from '../../components/ui';

const STATE = {
  working: { label: 'Working', cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10', dot: 'bg-emerald-400 animate-pulse' },
  blocked: { label: 'Blocked', cls: 'text-red-300 border-red-400/30 bg-red-400/10', dot: 'bg-red-400' },
  idle: { label: 'Idle', cls: 'text-gray-400 border-white/10 bg-white/[0.04]', dot: 'bg-gray-500' },
};

// The browser agent's execution layer: where it is, what it is doing, and
// every step it has taken. The steps come from the mission script.
export default function BrowserPanel({ browser, task, paused, recovering }) {
  const { url, title, steps } = browser;
  const last = steps[steps.length - 1];
  const state = task && !paused ? 'working' : recovering && last?.status === 'failed' ? 'blocked' : 'idle';
  const current =
    state === 'working' ? `${task.title}…` : state === 'blocked' ? `Stopped: ${last.text}` : last ? `Last: ${last.text}` : 'Waiting for a browser task';
  const meta = STATE[state];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MousePointerClick className="w-4 h-4 text-emerald-400" />
          Simulated Browser Session
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      <div className="mx-4 mb-3 rounded-xl border border-white/10 bg-black/60 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.03]">
          <span className="flex gap-1" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-red-400/60" />
            <span className="w-2 h-2 rounded-full bg-amber-400/60" />
            <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
          </span>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 text-[11px] text-gray-400">
            <Lock className="w-3 h-3 shrink-0 text-gray-600" />
            <span className="truncate" title={url}>
              {url ? url.replace(/^https?:\/\//, '') : 'about:blank'}
            </span>
          </div>
        </div>
        {title && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5 text-[11px] text-gray-300">
            <Globe className="w-3 h-3 text-gray-500 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
        )}

        {/* Current action */}
        <div className={`px-3 py-2 border-b border-white/5 text-xs ${state === 'blocked' ? 'text-red-300' : state === 'working' ? 'text-white' : 'text-gray-500'}`}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Current action</div>
          <div className="flex items-center gap-2">
            {state === 'working' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
            <span className="truncate">{current}</span>
          </div>
        </div>

        {/* History */}
        <div className="p-3 max-h-[220px] overflow-y-auto">
          {steps.length === 0 ? (
            <EmptyState title="No browser actions yet" className="!py-4">
              Steps appear here when a task needs a website.
            </EmptyState>
          ) : (
            <ol className="space-y-1.5" aria-label="Browser action history">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {s.status === 'failed' ? (
                    <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" aria-label="Failed" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" aria-label="Done" />
                  )}
                  <span className={s.status === 'failed' ? 'text-red-300' : 'text-gray-300'}>{s.text}</span>
                  <span className="ml-auto pl-2 font-mono text-[10px] text-gray-600">{formatClock(s.t)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <p className="px-4 pb-3 text-[10px] text-gray-600">Browser agent steps are scripted for this demo. No external site is opened.</p>
    </div>
  );
}
