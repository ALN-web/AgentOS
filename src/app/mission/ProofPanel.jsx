import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, CheckCircle2, Circle, ChevronDown, ListChecks, ShieldAlert, XCircle, AlertTriangle, RotateCcw, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { AgentIcon, agentName, formatDuration } from '../../components/ui';
import { taskCounts, taskDuration } from '../../engine/selectors';

const STATUS_ICONS = {
  done: { icon: CheckCircle2, cls: 'text-emerald-400' },
  failed: { icon: XCircle, cls: 'text-red-400' },
  awaiting: { icon: ShieldAlert, cls: 'text-amber-300' },
  running: { icon: Loader2, cls: 'text-[#eb6920] animate-spin' },
  pending: { icon: Clock, cls: 'text-gray-500' },
  skipped: { icon: Clock, cls: 'text-gray-600' }
};

export default function ProofPanel({ m }) {
  const [expandedTask, setExpandedTask] = useState(null);

  if (!m) return null;

  const { total, done } = taskCounts(m);
  const failedTasks = m.tasks.filter(t => t.status === 'failed').length;
  const recoveries = m.recoveries;
  const checks = m.checks || [];
  const criteria = m.plan?.criteria || [];
  const pendingApprovals = m.approvals.filter(a => a.status === 'pending');
  const decidedApprovals = m.approvals.filter(a => a.status !== 'pending');

  const isVerified = m.status === 'completed' && checks.length > 0 && checks.every(c => c.status === 'done');
  
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-6" aria-label="Proof and Verification Panel">
      {/* MISSION SUMMARY */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
          {isVerified ? (
            <span className="text-emerald-400 flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5" /> Mission Verified</span>
          ) : (
            <span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Mission Status</span>
          )}
        </div>
        <h3 className="text-sm font-bold text-white leading-snug mb-3">{m.goal}</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/40 rounded-lg p-2 border border-white/5">
            <div className="text-gray-500 mb-0.5">Tasks</div>
            <div className="font-semibold text-white">{done} / {total} done</div>
          </div>
          {(failedTasks > 0 || recoveries.length > 0) && (
            <div className="bg-black/40 rounded-lg p-2 border border-white/5">
              <div className="text-gray-500 mb-0.5">Issues</div>
              <div className="font-semibold text-white">
                {failedTasks > 0 ? <span className="text-red-400">{failedTasks} failed</span> : null}
                {failedTasks > 0 && recoveries.length > 0 ? ' · ' : null}
                {recoveries.length > 0 ? <span className="text-[#ff9a5c]">{recoveries.length} recovered</span> : null}
              </div>
            </div>
          )}
          {m.approvals.length > 0 && (
            <div className="bg-black/40 rounded-lg p-2 border border-white/5">
              <div className="text-gray-500 mb-0.5">Approvals</div>
              <div className="font-semibold text-white">
                {pendingApprovals.length > 0 ? <span className="text-amber-300">{pendingApprovals.length} pending</span> : <span>{decidedApprovals.length} decided</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS CRITERIA */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Verification</div>
        {checks.length === 0 ? (
          criteria.length > 0 ? (
            <ul className="space-y-2">
              {criteria.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-xs text-gray-400">
                  <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-600" />
                  {c.label}
                </li>
              ))}
              {pendingApprovals.length > 0 && (
                <li className="flex items-start gap-2 text-xs text-amber-300">
                  <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Pending approval
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-gray-600">Runs once the work is done. Nothing counts until it’s checked.</p>
          )
        ) : (
          <ul className="space-y-2">
            {checks.map((c, i) => {
              const Icon = STATUS_ICONS[c.status]?.icon || CheckCircle2;
              const cls = STATUS_ICONS[c.status]?.cls || 'text-emerald-400';
              return (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cls}`} />
                  {c.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* TASK RESULTS */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 flex justify-between items-center">
          Task Results
          <span className="text-emerald-400/50 border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest">{m.demo ? 'Simulated' : 'Live'}</span>
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {m.tasks.map((t) => {
            const isExpanded = expandedTask === t.id;
            const Icon = STATUS_ICONS[t.status]?.icon || Clock;
            const iconCls = STATUS_ICONS[t.status]?.cls || 'text-gray-500';
            
            const rec = recoveries.find(r => r.task === t.title);
            // Approval payload requires checking events or approvals matching this task
            const approval = m.approvals.find(a => a.title === t.title);
            
            return (
              <div key={t.id} className="border border-white/5 rounded-xl bg-black/20 overflow-hidden">
                <button 
                  onClick={() => setExpandedTask(isExpanded ? null : t.id)}
                  className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${iconCls}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${t.status === 'failed' ? 'text-gray-400 line-through' : 'text-gray-200'} truncate`}>{t.title}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <AgentIcon id={t.agent} size="sm" />
                        <span className="truncate">{agentName(t.agent)}</span>
                        {t.status === 'done' && <span className="opacity-50 shrink-0">· {formatDuration(taskDuration(t, m.clock))}</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform shrink-0 ml-2 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-3 pt-1 border-t border-white/5 text-[11px] text-gray-400 space-y-2 overflow-hidden"
                    >
                      {t.status === 'failed' && rec && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-300">
                          <div className="font-semibold mb-1">Failed Attempt</div>
                          <div className="text-red-400/80 mb-2">{rec.error}</div>
                          {rec.status === 'resolved' && (
                            <div className="text-[#ff9a5c] border-t border-red-500/20 pt-1 mt-1">
                              Recovered: {rec.plan}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {approval && (
                        <div className={`rounded-lg p-2 border ${approval.status === 'pending' ? 'bg-amber-400/10 border-amber-400/30 text-amber-300' : 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300'}`}>
                          <div className="font-semibold">{approval.status === 'pending' ? 'Awaiting Approval' : `Approved (${approval.status})`}</div>
                          <div className="opacity-80 mt-1">{approval.reason}</div>
                        </div>
                      )}
                      
                      {t.status === 'done' && (
                        <div className="flex flex-col gap-1">
                          <div className="text-gray-500 font-semibold uppercase tracking-wider text-[9px]">Execution Result</div>
                          <div className="text-gray-300">
                            {m.demo ? (
                              <span className="italic text-gray-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Simulated completion evidence</span>
                            ) : (
                              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Verified real completion</span>
                            )}
                          </div>
                        </div>
                      )}

                      {t.status === 'skipped' && (
                         <div className="text-gray-500 italic">Task was skipped.</div>
                      )}

                      {t.status === 'pending' && (
                         <div className="text-gray-500 italic">Waiting to start.</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
