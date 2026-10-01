import React from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, CheckCircle2, Clapperboard, ListChecks, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { AgentIcon, formatClock } from '../../components/ui';
import { AppBadge } from '../../components/AppIcon';
import { missionSummary } from '../../engine/selectors';

function Stat({ icon: Icon, label, value, tone = 'text-white' }) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/5 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

const KIND_TONE = {
  task: 'text-emerald-400',
  recovery: 'text-[#ff9a5c]',
  approval: 'text-amber-300',
};

// The payoff: what the mission achieved and how, all derived from its state.
export default function MissionOutcome({ m, onReplay, replaying }) {
  const s = missionSummary(m);
  const met = m.metric.current >= m.metric.target;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative mb-4 rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-[#0c1510] to-[#0e0c12] overflow-hidden shadow-[0_0_50px_rgba(52,211,153,0.08)]"
      aria-label="Mission outcome"
    >
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-48 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mission complete
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Goal</div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mb-4">{m.goal}</h2>

            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Outcome · {m.isLive ? 'real' : 'simulated'}</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-4xl sm:text-5xl font-extrabold tabular-nums ${met ? 'text-emerald-300' : 'text-white'}`}>{m.isLive ? Math.min(m.metric.current, m.metric.target) : m.metric.current}</span>
              <span className="text-lg text-gray-500 font-semibold">/ {m.metric.target}</span>
              <span className="text-sm text-gray-400">{m.metric.label.toLowerCase()}</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-1 font-mono">Mission time {formatClock(m.clock)}</div>
            <p className="text-[11px] text-gray-500 mt-2 max-w-md">
              {m.isLive
                ? 'Real actions in your connected apps, each re-checked in the app itself. Open the proof links below.'
                : 'This is the verified result of the scripted demo run. No real registrations, emails or posts were created.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 lg:w-[420px] shrink-0">
            <Stat icon={ListChecks} label="Tasks done" value={`${s.counts.done} / ${s.counts.total}`} tone="text-emerald-300" />
            <Stat icon={Users} label="Agents involved" value={s.agents.length} />
            <Stat icon={RotateCcw} label="Recoveries" value={s.recoveries} tone={s.recoveries ? 'text-[#ff9a5c]' : 'text-white'} />
            <Stat icon={ShieldCheck} label="Human approvals" value={s.approvals} tone={s.approvals ? 'text-amber-300' : 'text-white'} />
            <Stat icon={BadgeCheck} label="Verification" value={s.verified ? 'Passed' : 'Not run'} tone={s.verified ? 'text-emerald-300' : 'text-gray-400'} />
            <div className="rounded-xl bg-black/40 border border-white/5 px-3.5 py-3 flex items-center">
              <div className="flex flex-wrap gap-1" aria-label="Agents involved">
                {s.agents.map((a) => (
                  <AgentIcon key={a} id={a} size="sm" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-white/5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">What AgentOS accomplished · {m.isLive ? 'real' : 'simulated'}</div>
          <ol className="md:columns-2 gap-x-6">
            {s.items.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="flex items-start gap-2.5 text-sm text-gray-200 mb-2 break-inside-avoid"
              >
                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${KIND_TONE[item.kind]}`} />
                <span>{item.text}</span>
              </motion.li>
            ))}
          </ol>
        </div>

        {s.appsUsed && s.appsUsed.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Apps used · {m.isLive ? 'connected' : 'simulated'}
              </div>
              <span className="text-[10px] text-gray-500">Cross-app workflow</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {s.appsUsed.map((app) => (
                <div key={app.id} className="rounded-xl bg-black/40 border border-white/5 p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <AppBadge appId={app.id} size="sm" />
                      <span className="text-[10px] text-gray-500 ml-auto tabular-nums font-mono">
                        {app.doneCount} / {app.tasksCount} done
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-gray-300">
                      {app.actions.map((act, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span className="line-clamp-2">{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {onReplay && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={onReplay} className="btn-orange px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Clapperboard className="w-3.5 h-3.5" />
              {replaying ? 'Replay from the start' : 'See how AgentOS worked'}
            </button>
            <span className="text-[11px] text-gray-500">Replays every step of this mission, including your decisions.</span>
          </div>
        )}
      </div>
    </motion.section>
  );
}
