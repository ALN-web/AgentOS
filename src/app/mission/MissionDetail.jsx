import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, GitBranch, MessagesSquare, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { useMission, useMissions } from '../../store/MissionStore';
import { ProgressRing, StatusPill, formatClock } from '../../components/ui';
import ApprovalCard from '../../components/ApprovalCard';
import TaskGraph from './TaskGraph';
import ActivityFeed from './ActivityFeed';
import BrowserPanel from './BrowserPanel';
import RecoveryCard from './RecoveryCard';
import VerificationCard from './VerificationCard';

const SPEEDS = [1, 2, 4];

function Panel({ icon: Icon, title, right, children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="w-4 h-4 text-[#eb6920]" />
          {title}
        </div>
        {right}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export default function MissionDetail() {
  const { id } = useParams();
  const m = useMission(id);
  const { setSpeed, togglePause, launch } = useMissions();
  const navigate = useNavigate();

  if (!m) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-xl font-bold text-white mb-2">Mission not found</h1>
        <p className="text-sm text-gray-400 mb-6">Missions live in memory in this demo and reset when the page reloads.</p>
        <Link to="/app" className="btn-orange px-5 py-2.5 rounded-xl text-sm font-semibold">
          Back to missions
        </Link>
      </div>
    );
  }

  const done = m.status === 'completed';
  const pending = m.approvals.filter((a) => a.status === 'pending');
  const browserTask = m.tasks.find((t) => t.agent === 'browser' && t.status === 'running');
  const doneTasks = m.tasks.filter((t) => t.status === 'done').length;
  const recoveries = [...m.recoveries].reverse();

  // Approvals and recoveries are the moments the audience should see, so they
  // sit at the top of the page on narrow screens and in the side column on wide ones.
  const attention = (
    <>
      <AnimatePresence>
        {pending.map((a) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <ApprovalCard approval={a} />
          </motion.div>
        ))}
      </AnimatePresence>
      {recoveries.map((r) => (
        <RecoveryCard key={r.id} recovery={r} />
      ))}
    </>
  );

  return (
    <div>
      <Link to="/app" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white mb-5">
        <ArrowLeft className="w-3.5 h-3.5" />
        All missions
      </Link>

      {/* Header */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 mb-4 flex flex-col md:flex-row md:items-center gap-6">
        <ProgressRing value={m.metric.current} target={m.metric.target} size={104}>
          <span className="text-2xl font-extrabold text-white tabular-nums leading-none">{m.metric.current}</span>
          <span className="text-[10px] text-gray-500 mt-1">of {m.metric.target}</span>
        </ProgressRing>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusPill status={m.status} paused={m.paused} />
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-mono">
              <Timer className="w-3 h-3" />
              {formatClock(m.clock)}
            </span>
            <span className="text-[11px] text-gray-500">
              · {doneTasks}/{m.tasks.length} tasks · {m.recoveries.length} recovered
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{m.goal}</h1>
          <p className="text-xs text-gray-500 mt-1">{m.metric.label}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {done ? (
            <button
              onClick={() => navigate(`/app/missions/${launch(m.goal)}`)}
              className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Run again
            </button>
          ) : (
            <>
              <div className="flex rounded-xl border border-white/10 overflow-hidden">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(m.id, s)}
                    className={`px-2.5 py-2 text-xs font-semibold transition-colors ${
                      m.speed === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <button
                onClick={() => togglePause(m.id)}
                aria-label={m.paused ? 'Resume' : 'Pause'}
                className="btn-dark w-9 h-9 rounded-xl flex items-center justify-center"
              >
                {m.paused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {(pending.length > 0 || recoveries.length > 0) && <div className="xl:hidden flex flex-col gap-4 mb-4">{attention}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left: graph + activity */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          <Panel icon={GitBranch} title="Task graph" className="h-[340px]">
            <TaskGraph tasks={m.tasks} />
          </Panel>
          <Panel
            icon={MessagesSquare}
            title="Agent activity"
            right={<span className="text-[11px] text-gray-500">{m.events.length} events</span>}
            className="h-[480px]"
          >
            <div className="h-full p-4">
              <ActivityFeed events={m.events} />
            </div>
          </Panel>
        </div>

        {/* Right: what needs attention */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="hidden xl:flex flex-col gap-4">{attention}</div>
          <BrowserPanel browser={m.browser} active={!!browserTask && !m.paused} />
          <VerificationCard checks={m.checks} />
        </div>
      </div>
    </div>
  );
}
