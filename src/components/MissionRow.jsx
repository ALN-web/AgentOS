import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { AgentIcon, ProgressBar, StatusPill, timeAgo } from './ui';
import { involvedAgents } from '../engine/selectors';

export const ROW_GRID = 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_150px_180px_90px]';

export function MissionHeader() {
  return (
    <div className={`hidden xl:grid ${ROW_GRID} gap-6 px-5 py-3 border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-gray-500`}>
      <span>Goal</span>
      <span>Status</span>
      <span>Progress</span>
      <span className="text-right">Updated</span>
    </div>
  );
}

export default function MissionRow({ m, now }) {
  const agents = involvedAgents(m);
  return (
    <Link
      to={`/app/missions/${m.id}`}
      className={`grid ${ROW_GRID} gap-3 xl:gap-6 items-center px-5 py-4 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-0 focus:outline-none focus-visible:bg-white/[0.05]`}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate">{m.goal}</div>
        <div className="flex items-center gap-1 mt-2">
          {agents.slice(0, 8).map((a) => (
            <AgentIcon key={a} id={a} size="sm" />
          ))}
          {m.recoveries.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-[#ff9a5c] whitespace-nowrap">
              <RotateCcw className="w-3 h-3" />
              {m.recoveries.length} {m.recoveries.length === 1 ? 'recovery' : 'recoveries'}
            </span>
          )}
        </div>
      </div>
      <div>
        <StatusPill status={m.status} paused={m.paused} />
      </div>
      <div>
        <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
          <span className="truncate">{m.metric.label}</span>
          <span className="tabular-nums text-gray-300">
            {m.metric.current}/{m.metric.target}
          </span>
        </div>
        <ProgressBar value={m.metric.current} target={m.metric.target} />
      </div>
      <div className="text-xs text-gray-500 xl:text-right">{timeAgo(m.updatedAt, now)}</div>
    </Link>
  );
}
