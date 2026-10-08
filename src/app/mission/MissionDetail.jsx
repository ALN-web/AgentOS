import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clapperboard, GitBranch, Loader2, MessagesSquare, Pause, Play, RotateCcw, ShieldCheck, ListChecks } from 'lucide-react';
import { useMission, useMissions } from '../../store/MissionStore';
import { useLiveMission } from '../../live/useLiveMission';
import { EmptyState } from '../../components/ui';
import ApprovalCard from '../../components/ApprovalCard';
import { explainEvent, explainTask } from '../../engine/selectors';
import TaskGraph from './TaskGraph';
import MissionControl from './MissionControl';
import ActivityFeed from './ActivityFeed';
import BrowserPanel from './BrowserPanel';
import RecoveryCard from './RecoveryCard';
import ProofPanel from './ProofPanel';
import ExplainDrawer from './ExplainDrawer';
import MissionBrief from './MissionBrief';
import MissionOutcome from './MissionOutcome';
import ReplayBar from './ReplayBar';
import TaskResults from './TaskResults';
import { replayLength, replayTo } from '../../engine/engine';

const REPLAY_TICK = 100;

const SPEEDS = [1, 2, 4];

function Panel({ icon: Icon, title, right, children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl flex flex-col overflow-clip ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 sm:px-5 sm:pt-4 sm:pb-3 border-b border-white/5">
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
  const localMission = useMission(id);
  const { mission: liveMission, evidence: liveEvidence, decideApproval: decideLiveApproval, loading: liveLoading } = useLiveMission(id);
  const m = liveMission || localMission;
  const { setSpeed, togglePause, restart, startDemo } = useMissions();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null); // { kind: 'event' | 'task', id }

  const selectEvent = useCallback((e) => setSelected({ kind: 'event', id: e.id }), []);
  const selectTask = useCallback((t) => setSelected({ kind: 'task', id: t.id }), []);
  const closeExplain = useCallback(() => setSelected(null), []);

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

  useEffect(() => setReplay(null), [id]);

  if (!m) {
    if (liveLoading) {
      return (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#eb6920] animate-spin" />
          <span className="text-sm font-semibold text-gray-400">Loading mission from backend...</span>
        </div>
      );
    }
    return (
      <EmptyState icon={GitBranch} title="Mission not found" className="py-24">
        This mission isn’t in this browser’s demo data. It may have been reset, or opened from another browser.
        <span className="flex flex-wrap justify-center gap-2 mt-5">
          <button
            onClick={() => navigate(`/app/missions/${startDemo()}`)}
            className="btn-orange px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Try Demo Mission
          </button>
          <Link to="/app/missions" className="btn-dark px-5 py-2.5 rounded-xl text-sm font-semibold">
            Back to missions
          </Link>
        </span>
      </EmptyState>
    );
  }

  const restartRun = () => {
    setSelected(null);
    setReplay(null);
    restart(m.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const view = replayView || m;
  const replaying = !!replay;
  const done = view.status === 'completed';
  const pending = view.approvals.filter((a) => a.status === 'pending');
  const decided = view.approvals.filter((a) => a.status !== 'pending');
  const browserTask = view.tasks.find((t) => t.agent === 'browser' && t.status === 'running');
  const recoveries = [...view.recoveries].reverse();

  let explanation = null;
  if (selected?.kind === 'event') {
    const e = view.events.find((x) => x.id === selected.id);
    if (e) explanation = explainEvent(view, e);
  } else if (selected?.kind === 'task') {
    const t = view.tasks.find((x) => x.id === selected.id);
    if (t) explanation = explainTask(view, t);
  }

  const approvalsList = (
    <div className="flex flex-col gap-4">
      {pending.map((a) => (
        <motion.div key={a.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <ApprovalCard approval={a} readOnly={replaying} onDecide={m?.isLive ? decideLiveApproval : undefined} />
        </motion.div>
      ))}
      {decided.map((a) => (
        <motion.div key={a.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <ApprovalCard approval={a} compact readOnly={replaying} />
        </motion.div>
      ))}
    </div>
  );

  const recoveriesList = (
    <div className="flex flex-col gap-4">
      {recoveries.map((r) => (
        <RecoveryCard key={r.id} recovery={r} events={view.events} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full pb-8">
      <div className="shrink-0 mb-4">
        <Link to="/app/missions" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" />
          All missions
        </Link>
      </div>

      {replaying && (
        <div className="shrink-0 mb-4">
          <ReplayBar
            replay={replay}
            total={total}
            onChange={updateReplay}
            onExit={() => setReplay(null)}
          />
        </div>
      )}

      {/* Responsive two-column workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] 2xl:grid-cols-[minmax(0,2.5fr)_minmax(360px,1fr)] gap-5 items-start">
        
        {/* LEFT COLUMN: Main Workspace */}
        <div className="flex flex-col gap-5 min-w-0">
          <MissionControl
            m={view}
            controls={
              replaying ? null : done ? (
                m?.isLive ? (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Live Mission Completed</span>
                  </div>
                ) : (
                  <>
                    <button onClick={startReplay} className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <Clapperboard className="w-3.5 h-3.5" />
                      Replay
                    </button>
                    <button onClick={restartRun} className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restart
                    </button>
                  </>
                )
              ) : m?.isLive ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Stream Active</span>
                  </div>
                </div>
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
                  <button
                    onClick={restartRun}
                    aria-label="Restart mission"
                    title="Restart from the beginning"
                    className="btn-dark w-9 h-9 rounded-xl flex items-center justify-center"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )
            }
          />

          {done && <MissionOutcome m={view} evidence={liveEvidence || []} onReplay={completed ? startReplay : null} replaying={replaying} />}

          {(pending.length > 0 || recoveries.length > 0 || decided.length > 0) && (
            <div className="xl:hidden flex flex-col gap-4">
              {approvalsList}
              {recoveriesList}
            </div>
          )}

          <Panel
            icon={GitBranch}
            title="Mission plan"
            right={<span className="text-[11px] text-gray-500 hidden sm:inline">{view.tasks.length} tasks · click a task to see why</span>}
            className="h-[360px] sm:h-[400px]"
          >
            <TaskGraph tasks={view.tasks} goal={view.goal} clock={view.clock} onSelect={selectTask} />
          </Panel>

          <Panel
            icon={MessagesSquare}
            title="Agent activity"
            right={<span className="text-[11px] text-gray-500">{view.events.length} events</span>}
            className="h-[500px]"
          >
            <div className="h-full p-3 sm:p-4">
              <ActivityFeed events={view.events} tasks={view.tasks} isLive={view.isLive} onSelect={selectEvent} selectedId={selected?.kind === 'event' ? selected.id : null} />
            </div>
          </Panel>
          
          <Panel
            icon={ListChecks}
            title="Task Results"
            right={<span className="text-[11px] text-gray-500">{view.tasks.length} tasks</span>}
            className="min-h-min"
          >
            <div className="p-3 sm:p-4">
              <TaskResults m={view} />
            </div>
          </Panel>
          
          {recoveries.length > 0 && (
             <div className="hidden xl:flex flex-col gap-4 mt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Recovery Actions</div>
                {recoveriesList}
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: Mission Inspector */}
        <div className="flex flex-col gap-4 min-w-0 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto pb-4 pr-1">
          <MissionBrief plan={m.plan} />
          
          <ProofPanel m={view} />

          {(pending.length > 0 || decided.length > 0) && (
            <div className="hidden xl:flex flex-col gap-4 mt-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 ml-1">Approvals</div>
              {approvalsList}
            </div>
          )}
          
          {view.browser && <BrowserPanel browser={view.browser} task={browserTask} paused={view.paused} recovering={view.status === 'recovering'} />}
        </div>
      </div>

      <ExplainDrawer explanation={explanation} onClose={closeExplain} />
    </div>
  );
}

