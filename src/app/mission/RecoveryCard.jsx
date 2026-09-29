import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, GitBranch, Play, Radar, RotateCcw, Search, Workflow, XCircle } from 'lucide-react';
import { agentName, formatDuration } from '../../components/ui';

const ORDER = ['diagnosing', 'replanning', 'retrying', 'resolved'];

const TONE = {
  fail: 'text-red-300 border-red-400/30 bg-red-400/10',
  work: 'text-[#ff9a5c] border-[#eb6920]/30 bg-[#eb6920]/10',
  ok: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
};

// The full story of one failure: what broke, why, what changed, and whether
// the mission got back on track. Built from the recovery record and the events
// the agents logged while it happened.
export default function RecoveryCard({ recovery, events = [] }) {
  const stage = ORDER.indexOf(recovery.status);
  const resolved = recovery.status === 'resolved';
  const failure = events.find((e) => e.type === 'failure' && e.t === recovery.startedAt);
  const replan = events.find((e) => e.agent === 'planner' && e.type === 'plan' && e.t >= (recovery.retryingAt ?? Infinity));
  const resumed = events.find((e) => e.agent === 'execution' && e.t >= (recovery.retryingAt ?? Infinity));
  const tookMs = resolved ? recovery.resolvedAt - recovery.startedAt : null;

  const chain = [
    { icon: XCircle, tone: 'fail', label: 'Execution failed', text: recovery.error, reached: true },
    {
      icon: Radar,
      tone: 'fail',
      label: 'Failure detected',
      text: failure ? `${agentName(failure.agent)} reported it. The task was stopped instead of retried blindly.` : null,
      reached: true,
    },
    { icon: RotateCcw, tone: 'work', label: 'Recovery agent activated', text: null, reached: stage >= 0 },
    { icon: Search, tone: 'work', label: 'Root cause identified', text: recovery.diagnosis, reached: stage >= 1 },
    { icon: Workflow, tone: 'work', label: 'Alternative strategy', text: recovery.plan, reached: stage >= 2 },
    { icon: GitBranch, tone: 'work', label: 'Planner updated the plan', text: replan?.text, reached: !!replan },
    { icon: Play, tone: 'work', label: 'Execution resumed', text: resumed?.text, reached: !!resumed },
    {
      icon: CheckCircle2,
      tone: 'ok',
      label: 'Mission recovered',
      text: resolved ? `Back on track ${formatDuration(tookMs)} after the failure.` : null,
      reached: resolved,
    },
  ];
  const nextIdx = chain.findIndex((c) => !c.reached);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl border p-5 relative overflow-hidden transition-colors duration-700 ${
        resolved ? 'border-[#eb6920]/30 bg-[#140f0b]' : 'border-red-500/40 bg-[#160c0c] shadow-[0_0_40px_rgba(239,68,68,0.12)]'
      }`}
    >
      {!resolved && <div className="absolute -top-16 -right-16 w-40 h-40 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />}

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {resolved ? (
              <RotateCcw className="w-4 h-4 text-[#eb6920]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            Failure → Recovery
          </div>
          <div className="text-[11px] text-gray-500 truncate mt-0.5">{recovery.task}</div>
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
            resolved ? TONE.ok : 'text-red-300 border-red-400/30 bg-red-400/10'
          }`}
        >
          {resolved ? 'Recovered' : 'Recovering'}
        </span>
      </div>

      <ol className="relative">
        {chain.map(({ icon: Icon, tone, label, text, reached }, i) => {
          const last = i === chain.length - 1;
          const working = i === nextIdx && !resolved;
          return (
            <li key={label} className="relative flex gap-3 pb-3 last:pb-0">
              {!last && (
                <span
                  className={`absolute left-3 top-6 bottom-0 w-px transition-colors duration-500 ${
                    chain[i + 1].reached ? (tone === 'fail' ? 'bg-red-400/30' : 'bg-[#eb6920]/40') : 'bg-white/[0.06]'
                  }`}
                />
              )}
              <span
                className={`relative w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-500 ${
                  reached ? TONE[tone] : working ? 'text-gray-400 border-white/20 bg-white/[0.04] animate-pulse' : 'text-gray-600 border-white/5 bg-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className={`min-w-0 pt-0.5 transition-opacity duration-500 ${reached ? 'opacity-100' : working ? 'opacity-70' : 'opacity-30'}`}>
                <div className="text-xs font-semibold text-gray-200">
                  {label}
                  {working && <span className="ml-1.5 text-[10px] font-normal text-gray-500">in progress…</span>}
                </div>
                {text && reached && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-gray-400 leading-relaxed mt-0.5">
                    {text}
                  </motion.p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
