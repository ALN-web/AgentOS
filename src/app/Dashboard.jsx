import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Inbox, Network, Play, Rocket, RotateCcw, Zap } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { ACTIVE_STATUSES } from '../engine/engine';
import { activeAgents } from '../engine/selectors';
import { AGENTS } from '../data/agents';
import { AgentIcon, EmptyState } from '../components/ui';
import MissionRow, { MissionHeader } from '../components/MissionRow';
import { DEMO_GOAL } from '../data/templates';
import ResetDemoButton from '../components/ResetDemoButton';

const RECENT = 5;

function Stat({ icon: Icon, label, value, tone = 'text-white', to, hint }) {
  const body = (
    <div className={`glass-card rounded-2xl p-4 sm:p-5 h-full ${to ? 'hover:!border-[#eb6920]/40' : ''}`}>
      <div className="flex items-center justify-between text-gray-500 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div className={`text-3xl font-extrabold tabular-nums ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6920]/60 rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function Dashboard() {
  const { missions, launch, startDemo } = useMissions();
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const now = Date.now();

  const active = missions.filter((m) => ACTIVE_STATUSES.includes(m.status));
  const completed = missions.filter((m) => m.status === 'completed');
  const approvals = missions.reduce((n, m) => n + m.approvals.filter((a) => a.status === 'pending').length, 0);
  const recoveries = missions.reduce((n, m) => n + m.recoveries.length, 0);

  // Which agent is busy, and on which mission, across everything running now.
  const busy = {};
  active
    .filter((m) => !m.paused)
    .forEach((m) => activeAgents(m).forEach((a) => (busy[a] ||= m)));

  const start = (e) => {
    e?.preventDefault();
    navigate(`/app/missions/${goal.trim() ? launch(goal) : startDemo()}`);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Tell AgentOS what you want done. It handles the rest.</p>
          <p className="text-[11px] text-gray-500 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Missions are saved in this browser only.</span>
            <ResetDemoButton />
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/app/missions/${startDemo()}`)}
          className="btn-orange self-start sm:self-auto px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Try Demo Mission
        </button>
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
        <button type="submit" className="btn-dark px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <Zap className="w-3.5 h-3.5" />
          Launch
        </button>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Stat icon={Zap} label="Active missions" value={active.length} tone="text-[#ff9a5c]" to="/app/missions" />
        <Stat icon={CheckCircle2} label="Completed" value={completed.length} tone="text-emerald-300" to="/app/missions" />
        <Stat icon={Inbox} label="Awaiting approval" value={approvals} tone="text-amber-300" to="/app/approvals" />
        <Stat icon={RotateCcw} label="Recovery events" value={recoveries} tone="text-red-300" hint="Failures handled without you" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-8 glass-card rounded-2xl overflow-hidden" aria-labelledby="recent-missions">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 id="recent-missions" className="text-sm font-semibold text-white">
              Recent missions
            </h2>
            {missions.length > 0 && (
              <Link to="/app/missions" className="inline-flex items-center gap-1 text-xs font-semibold text-[#eb6920] hover:text-[#ff9a5c]">
                View all {missions.length} <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          {missions.length > 0 && <MissionHeader />}
          {missions.slice(0, RECENT).map((m) => (
            <MissionRow key={m.id} m={m} now={now} />
          ))}
          {missions.length === 0 && (
            <EmptyState
              icon={Rocket}
              title="No active missions"
              action={
                <button onClick={start} className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5">
                  Run the demo mission <ArrowRight className="w-3 h-3" />
                </button>
              }
            >
              Launch a mission and let AgentOS take it from here.
            </EmptyState>
          )}
        </section>

        <section className="xl:col-span-4 glass-card rounded-2xl p-5" aria-labelledby="workforce-status">
          <div className="flex items-center justify-between mb-4">
            <h2 id="workforce-status" className="text-sm font-semibold text-white">
              Workforce status
            </h2>
            <span className="text-[11px] text-gray-500">
              {Object.keys(busy).length} of {AGENTS.length} active
            </span>
          </div>
          <ul className="space-y-1.5">
            {AGENTS.map((a) => {
              const m = busy[a.id];
              return (
                <li key={a.id}>
                  <Link
                    to={m ? `/app/missions/${m.id}` : '/app/workforce'}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/[0.04] transition-colors"
                  >
                    <AgentIcon id={a.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white">{a.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{m ? m.goal : a.role}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${m ? 'text-white' : 'text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m ? 'animate-pulse' : ''}`} style={{ background: m ? a.color : '#4b5563' }} />
                      {m ? 'Active' : 'Idle'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link to="/app/workforce" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#eb6920] hover:text-[#ff9a5c]">
            <Network className="w-3.5 h-3.5" />
            Open the workforce graph
          </Link>
        </section>
      </div>
    </div>
  );
}
