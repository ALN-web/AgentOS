import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Clapperboard, GitBranch, MessagesSquare, Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMission, useMissions } from '../../store/MissionStore';
import { EmptyState } from '../../components/ui';
import ApprovalCard from '../../components/ApprovalCard';
import { explainEvent, explainTask } from '../../engine/selectors';
import TaskGraph from './TaskGraph';
import MissionControl from './MissionControl';
import ActivityFeed from './ActivityFeed';
import BrowserPanel from './BrowserPanel';
import RecoveryCard from './RecoveryCard';
import VerificationCard from './VerificationCard';
import ExplainDrawer from './ExplainDrawer';
import MissionOutcome from './MissionOutcome';
import ReplayBar from './ReplayBar';
import { replayLength, replayTo } from '../../engine/engine';

const REPLAY_TICK = 100;

const SPEEDS = [1, 2, 4];

function Panel({ icon: Icon, title, right, children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/5">
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
  const [selected, setSelected] = useState(null); // { kind: 'event' | 'task', id }

  const selectEvent = useCallback((e) => setSelected({ kind: 'event', id: e.id }), []);
  const selectTask = useCallback((t) => setSelected({ kind: 'task', id: t.id }), []);
  const closeExplain = useCallback(() => setSelected(null), []);

  // Replay is a playhead over mission time. The state shown at each position
  // comes from the engine (replayTo), never from a copy kept here.
  const [replay, setReplay] = useState(null); // { t, playing, speed }
  const completed = m?.status === 'completed';
  const total = useMemo(() => (m && completed ? replayLength(m) : 0), [m, completed]);
  const replayView = useMemo(() => (m && replay ? replayTo(m, replay.t) : null), [m, replay?.t]);
  const updateReplay = useCallback((patch) => setReplay((r) => (r ? { ...r, ...patch } : r)), []);
  const startReplay = useCallback(() => {
    setSelected(null);
    setReplay((r) => ({ t: 0, playing: true, speed: r?.speed || 1 }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const playing = !!replay?.playing;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setReplay((r) => {
        if (!r) return r;
        const t = Math.min(total, r.t + REPLAY_TICK * r.speed);
        return { ...r, t, playing: t < total };
      });
    }, REPLAY_TICK);
    return () => clearInterval(id);
  }, [playing, total]);

  // Leaving the page or switching missions ends the replay.
  useEffect(() => setReplay(null), [id]);

  if (!m) {
    return (
      <EmptyState icon={GitBranch} title="Mission not found" className="py-24">
        Missions live in memory in this demo and reset when the page reloads.
        <span className="block mt-5">
          <Link to="/app/missions" className="btn-orange inline-block px-5 py-2.5 rounded-xl text-sm font-semibold">
            Back to missions
          </Link>
        </span>
      </EmptyState>
    );
  }

  const view = replayView || m;
  const replaying = !!replay;
  const done = view.status === 'completed';
  const pending = view.approvals.filter((a) => a.status === 'pending');
  const decided = view.approvals.filter((a) => a.status !== 'pending');
  const browserTask = view.tasks.find((t) => t.agent === 'browser' && t.status === 'running');
  const recoveries = [...view.recoveries].reverse();

  // Explanations are recomputed from the current state, so an open drawer stays live.
  let explanation = null;
  if (selected?.kind === 'event') {
    const e = view.events.find((x) => x.id === selected.id);
    if (e) explanation = explainEvent(view, e);
  } else if (selected?.kind === 'task') {
    const t = view.tasks.find((x) => x.id === selected.id);
    if (t) explanation = explainTask(view, t);
  }

  // Approvals and recoveries are the moments the audience should see, so they
  // sit at the top of the page on narrow screens and in the side column on wide ones.
  const attention = (
    <>
      <AnimatePresence>
        {pending.map((a) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <ApprovalCard approval={a} readOnly={replaying} />
          </motion.div>
        ))}
      </AnimatePresence>
      {recoveries.map((r) => (
        <RecoveryCard key={r.id} recovery={r} events={view.events} />
      ))}
      {decided.map((a) => (
        <motion.div key={a.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <ApprovalCard approval={a} compact readOnly={replaying} />
        </motion.div>
      ))}
    </>
  );

  return (
    <div>
      <Link to="/app/missions" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white mb-5">
        <ArrowLeft className="w-3.5 h-3.5" />
        All missions
      </Link>

      {replaying && (
        <ReplayBar
          replay={replay}
          total={total}
          onChange={updateReplay}
          onExit={() => setReplay(null)}
        />
      )}

      <MissionControl
        m={view}
        controls={
          replaying ? null : done ? (
            <>
              <button onClick={startReplay} className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Clapperboard className="w-3.5 h-3.5" />
                Replay
              </button>
              <button
                onClick={() => navigate(`/app/missions/${launch(m.goal)}`)}
                className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Run again
              </button>
            </>
          ) : (
            <>
              <div className="flex rounded-xl border border-white/10 overflow-hidden" role="group" aria-label="Mission speed">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(m.id, s)}
                    aria-pressed={m.speed === s}
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
          )
        }
      />

      {done && <MissionOutcome m={view} onReplay={completed ? startReplay : null} replaying={replaying} />}

      {(pending.length > 0 || recoveries.length > 0 || decided.length > 0) && (
        <div className="xl:hidden flex flex-col gap-4 mb-4">{attention}</div>
      )}

      <Panel
        icon={GitBranch}
        title="Mission plan"
        right={<span className="text-[11px] text-gray-500 hidden sm:inline">{view.tasks.length} tasks · click a task to see why</span>}
        className="h-[360px] sm:h-[400px] mb-4"
      >
        <TaskGraph tasks={view.tasks} goal={view.goal} clock={view.clock} onSelect={selectTask} />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 flex flex-col gap-4">
          <Panel
            icon={MessagesSquare}
            title="Agent activity"
            right={<span className="text-[11px] text-gray-500">{view.events.length} events</span>}
            className="h-[560px]"
          >
            <div className="h-full p-3 sm:p-4">
              <ActivityFeed events={view.events} onSelect={selectEvent} selectedId={selected?.kind === 'event' ? selected.id : null} />
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="hidden xl:flex flex-col gap-4">{attention}</div>
          {recoveries.length === 0 && (
            <div className="glass-card rounded-2xl">
              <EmptyState icon={ShieldCheck} title="No recovery events" className="!py-6">
                AgentOS has not encountered a recoverable failure in this mission.
              </EmptyState>
            </div>
          )}
          <BrowserPanel browser={view.browser} task={browserTask} paused={view.paused} recovering={view.status === 'recovering'} />
          <VerificationCard checks={view.checks} />
        </div>
      </div>

      <ExplainDrawer explanation={explanation} onClose={closeExplain} />
    </div>
  );
}
