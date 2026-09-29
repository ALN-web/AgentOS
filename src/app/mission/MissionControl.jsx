import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ListTodo, RotateCcw, ShieldCheck, Timer, Target } from 'lucide-react';
import { AgentIcon, ProgressRing, StatusPill, formatClock } from '../../components/ui';
import { AGENT_BY_ID } from '../../data/agents';
import { activeAgents, activeRecovery, approvalState, currentObjective, taskCounts } from '../../engine/selectors';

function Tile({ icon: Icon, label, value, tone = 'text-white', className = '' }) {
  return (
    <div className={`rounded-xl bg-black/40 border border-white/5 px-3.5 py-3 min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-base sm:text-lg font-bold tabular-nums truncate ${tone}`}>{value}</div>
    </div>
  );
}

// The command-centre header: what the goal is, where it stands, and what
// AgentOS is doing this second.
export default function MissionControl({ m, controls }) {
  const counts = taskCounts(m);
  const agents = [...activeAgents(m)];
  const approval = approvalState(m);
  const recovery = activeRecovery(m);
  const done = m.status === 'completed';

  return (
    <div className={`glass-card rounded-2xl mb-4 overflow-hidden ${recovery ? '!border-red-500/40' : ''}`}>
      <AnimatePresence>
        {recovery && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500/[0.08] border-b border-red-500/25"
          >
            <div className="flex items-center gap-2.5 px-5 sm:px-6 py-2.5 text-xs" role="status">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-bold uppercase tracking-wider text-red-300">Execution failed</span>
              <span className="text-gray-300 truncate">{recovery.task}: {recovery.error}</span>
              <span className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-red-300 whitespace-nowrap">
                <RotateCcw className="w-3 h-3 animate-spin [animation-duration:2s]" />
                Recovery agent on it
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
        <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <ProgressRing value={m.metric.current} target={m.metric.target} size={96}>
            <span className="text-2xl font-extrabold text-white tabular-nums leading-none">{m.metric.current}</span>
            <span className="text-[10px] text-gray-500 mt-1">of {m.metric.target}</span>
          </ProgressRing>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#eb6920] mb-1.5">
              <Target className="w-3 h-3" />
              Mission goal
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">{m.goal}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <StatusPill status={m.status} paused={m.paused} />
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                title="This mission is a scripted simulation. No real emails, forms or posts are created."
              >
                Simulated
              </span>
              <span className="text-[11px] text-gray-500">{m.metric.label}</span>
            </div>
          </div>
        </div>

        {controls && <div className="flex items-center gap-2 shrink-0 flex-wrap">{controls}</div>}
      </div>

      {/* What is happening right now */}
      <div className="mx-5 sm:mx-6 mb-4 rounded-xl border border-white/5 bg-black/40 px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="relative flex w-2 h-2 mt-1.5 shrink-0">
            {!done && !m.paused && <span className="absolute inset-0 rounded-full bg-[#eb6920] animate-ping opacity-60" />}
            <span className={`relative w-2 h-2 rounded-full ${done ? 'bg-emerald-400' : 'bg-[#eb6920]'}`} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{done ? 'Result' : 'Current objective'}</div>
            <motion.div
              key={currentObjective(m)}
              initial={{ opacity: 0.4, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-semibold text-white"
              aria-live="polite"
            >
              {currentObjective(m)}
            </motion.div>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:justify-end min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 shrink-0">Active agents</span>
          {agents.length === 0 ? (
            <span className="text-xs text-gray-500">{done ? 'All agents idle' : m.paused ? 'Paused' : 'None'}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {agents.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-lg border text-[11px] font-semibold"
                  style={{ color: AGENT_BY_ID[a]?.color, borderColor: `${AGENT_BY_ID[a]?.color}33`, background: `${AGENT_BY_ID[a]?.color}0d` }}
                >
                  <AgentIcon id={a} size="sm" />
                  {AGENT_BY_ID[a]?.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-5 sm:px-6 pb-5 sm:pb-6">
        <Tile icon={CheckCircle2} label="Tasks done" value={`${counts.done} / ${counts.total}`} tone="text-emerald-300" />
        <Tile icon={ListTodo} label="Remaining" value={counts.remaining} />
        <Tile icon={Timer} label="Elapsed" value={formatClock(m.clock)} />
        <Tile
          icon={RotateCcw}
          label="Recoveries"
          value={m.recoveries.length}
          tone={recovery ? 'text-red-300' : m.recoveries.length ? 'text-[#ff9a5c]' : 'text-white'}
        />
        <Tile icon={ShieldCheck} label="Approval" value={approval.label} tone={approval.tone} className="col-span-2 sm:col-span-1" />
      </div>
    </div>
  );
}
