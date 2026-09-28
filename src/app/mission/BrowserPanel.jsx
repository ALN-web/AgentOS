import React from 'react';
import { Check, Lock, MousePointerClick, X } from 'lucide-react';
import { formatClock } from '../../components/ui';

export default function BrowserPanel({ browser, active }) {
  const { url, title, steps } = browser;

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MousePointerClick className="w-4 h-4 text-emerald-400" />
          Browser agent
        </div>
        <span className="text-[10px] font-mono text-gray-500">Playwright · Chromium</span>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-black/60 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-white/[0.03]">
          <span className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400/60" />
            <span className="w-2 h-2 rounded-full bg-amber-400/60" />
            <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
          </span>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 text-[11px] text-gray-400">
            <Lock className="w-3 h-3 shrink-0 text-gray-600" />
            <span className="truncate">{url || 'about:blank'}</span>
          </div>
        </div>

        <div className="p-3 min-h-[132px] max-h-[220px] overflow-y-auto">
          {title && <div className="text-[11px] font-semibold text-gray-300 mb-2">{title}</div>}
          {steps.length === 0 ? (
            <div className="text-xs text-gray-600 py-8 text-center">Waiting for a browser task…</div>
          ) : (
            <ul className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {s.status === 'failed' ? (
                    <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
                  )}
                  <span className={s.status === 'failed' ? 'text-red-300' : 'text-gray-300'}>{s.text}</span>
                  <span className="ml-auto pl-2 font-mono text-[10px] text-gray-600">{formatClock(s.t)}</span>
                </li>
              ))}
              {active && (
                <li className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </span>
                  Working…
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
