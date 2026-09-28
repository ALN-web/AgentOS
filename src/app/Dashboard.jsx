import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Inbox, Play, RotateCcw, XCircle, Zap } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { ACTIVE_STATUSES } from '../engine/engine';
import { AgentIcon, ProgressBar, StatusPill, timeAgo } from '../components/ui';
import { DEMO_GOAL } from '../data/templates';

function Stat({ icon: Icon, label, value, tone = 'text-white', to }) {
  const body = (
    <div className="glass-card rounded-2xl p-4 sm:p-5 h-full">
      <div className="flex items-center justify-between text-gray-500 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div className={`text-3xl font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function MissionRow({ m, now }) {
  const agents = [...new Set(m.tasks.map((t) => t.agent))];
  return (
    <Link
      to={`/app/missions/${m.id}`}
      className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_140px_180px_90px] gap-3 xl:gap-6 items-center px-5 py-4 hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-0"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate">{m.goal}</div>
        <div className="flex items-center gap-1 mt-2">
          {agents.slice(0, 6).map((a) => (
            <AgentIcon key={a} id={a} size="sm" />
          ))}
          {m.recoveries.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-red-300 whitespace-nowrap">
              <RotateCcw className="w-3 h-3" />
              {m.recoveries.length} recovered
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

export default function Dashboard() {
  const { missions, launch } = useMissions();
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const now = Date.now();

  const active = missions.filter((m) => ACTIVE_STATUSES.includes(m.status));
  const completed = missions.filter((m) => m.status === 'completed');
  const failed = missions.filter((m) => m.status === 'failed');
  const recoveries = missions.reduce((n, m) => n + m.recoveries.length, 0);
  const approvals = missions.reduce((n, m) => n + m.approvals.filter((a) => a.status === 'pending').length, 0);

  const start = (e) => {
    e.preventDefault();
    navigate(`/app/missions/${launch(goal.trim() || DEMO_GOAL)}`);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Missions</h1>
        <p className="text-sm text-gray-400 mt-1">Tell AgentOS what you want done. It handles the rest.</p>
      </div>

      <form onSubmit={start} className="glass-card rounded-2xl p-2 flex flex-col sm:flex-row gap-2 mb-8">
        <div className="flex items-center gap-3 flex-1 min-w-0 px-3">
          <Zap className="w-4 h-4 text-[#eb6920] shrink-0" />
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={DEMO_GOAL}
            aria-label="Mission goal"
            className="flex-1 min-w-0 bg-transparent py-3 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
        </div>
        <button type="submit" className="btn-orange px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <Play className="w-3.5 h-3.5 fill-current" />
          Launch
        </button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        <Stat icon={Zap} label="Active" value={active.length} tone="text-[#ff9a5c]" />
        <Stat icon={CheckCircle2} label="Completed" value={completed.length} tone="text-emerald-300" />
        <Stat icon={XCircle} label="Failed" value={failed.length} />
        <Stat icon={RotateCcw} label="Recoveries" value={recoveries} tone="text-red-300" />
        <Stat icon={Inbox} label="Approvals" value={approvals} tone="text-amber-300" to="/app/approvals" />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_140px_180px_90px] gap-6 px-5 py-3 border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <span>Goal</span>
          <span>Status</span>
          <span>Progress</span>
          <span className="text-right">Updated</span>
        </div>
        {missions.map((m) => (
          <MissionRow key={m.id} m={m} now={now} />
        ))}
        {missions.length === 0 && (
          <div className="p-10 text-center text-sm text-gray-500">
            No missions yet.{' '}
            <button onClick={start} className="text-[#eb6920] inline-flex items-center gap-1">
              Run the demo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
