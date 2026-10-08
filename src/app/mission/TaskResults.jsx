import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, ChevronDown, Loader2, ShieldAlert, XCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import { AgentIcon, agentName, formatDuration } from '../../components/ui';
import { taskDuration } from '../../engine/selectors';

const STATUS_ICONS = {
  done: { icon: CheckCircle2, cls: 'text-emerald-400' },
  failed: { icon: XCircle, cls: 'text-red-400' },
  awaiting: { icon: ShieldAlert, cls: 'text-amber-300' },
  running: { icon: Loader2, cls: 'text-[#eb6920] animate-spin' },
  pending: { icon: Clock, cls: 'text-gray-500' },
  skipped: { icon: Clock, cls: 'text-gray-600' }
};

export default function TaskResults({ m }) {
  const [expandedTask, setExpandedTask] = useState(null);

  if (!m || !m.tasks || m.tasks.length === 0) return null;

  const recoveries = m.recoveries || [];

  return (
    <div className="flex flex-col gap-2">
      {m.tasks.map((t) => {
        const isExpanded = expandedTask === t.id;
        const Icon = STATUS_ICONS[t.status]?.icon || Clock;
        const iconCls = STATUS_ICONS[t.status]?.cls || 'text-gray-500';
        
        const rec = recoveries.find(r => r.task === t.title);
        const approval = m.approvals.find(a => a.title === t.title);
        
        return (
          <div key={t.id} className="border border-white/5 rounded-xl bg-black/20 overflow-hidden">
            <button 
              onClick={() => setExpandedTask(isExpanded ? null : t.id)}
              className="w-full text-left px-3 py-2 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/[0.02] transition-colors gap-2"
              aria-expanded={isExpanded}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Icon className={`w-4 h-4 shrink-0 ${iconCls}`} />
                <div className="text-xs sm:text-sm font-semibold text-gray-200 truncate">
                  {t.status === 'failed' ? <span className="text-gray-400 line-through">{t.title}</span> : t.title}
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-6 sm:pl-0">
                <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1.5">
                  <AgentIcon id={t.agent} size="sm" />
                  <span className="truncate">{agentName(t.agent)}</span>
                  {t.status === 'done' && <span className="opacity-50 shrink-0">· {formatDuration(taskDuration(t, m.clock))}</span>}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4 border-t border-white/5 text-[11px] sm:text-xs text-gray-400 space-y-2 overflow-hidden"
                >
                  {t.status === 'failed' && rec && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300 mt-2">
                      <div className="font-semibold mb-1">Failed Attempt</div>
                      <div className="text-red-400/80 mb-2">{rec.error}</div>
                      {rec.status === 'resolved' && (
                        <div className="text-[#ff9a5c] border-t border-red-500/20 pt-2 mt-2">
                          Recovered: {rec.plan}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {approval && (
                    <div className={`rounded-lg p-3 border mt-2 ${approval.status === 'pending' ? 'bg-amber-400/10 border-amber-400/30 text-amber-300' : 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300'}`}>
                      <div className="font-semibold">{approval.status === 'pending' ? 'Awaiting Approval' : `Approved (${approval.status})`}</div>
                      <div className="opacity-80 mt-1">{approval.reason}</div>
                    </div>
                  )}
                  
                  {t.status === 'done' && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      <div className="text-gray-500 font-semibold uppercase tracking-wider text-[9px]">Execution Result</div>
                      <div className="text-gray-300">
                        {m.demo ? (
                          <span className="italic text-gray-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Simulated completion evidence</span>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Verified real completion</span>
                            {t.output?.html_link && (
                              <a
                                href={t.output.html_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eb6920]/40 bg-[#eb6920]/10 hover:bg-[#eb6920]/20 text-[#ff9a5c] hover:text-white text-xs font-semibold transition-all mt-1.5"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-[#eb6920]" />
                                <span>{t.output.html_link.includes('calendar') ? 'Open in Google Calendar' : 'Open in Gmail'}</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {t.status === 'skipped' && (
                     <div className="text-gray-500 italic mt-2">Task was skipped.</div>
                  )}

                  {t.status === 'pending' && (
                     <div className="text-gray-500 italic mt-2">Waiting to start.</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
