import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, FileSearch, Gauge, GitBranch, Lightbulb, Target, X, Zap } from 'lucide-react';
import { AgentIcon, agentName, formatClock, formatTime } from '../../components/ui';
import { AppBadge } from '../../components/AppIcon';
import { AGENT_BY_ID } from '../../data/agents';

function Section({ icon: Icon, label, children }) {
  return (
    <section className="py-4 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
        <Icon className="w-3 h-3 text-[#eb6920]" />
        {label}
      </div>
      {children}
    </section>
  );
}

// "Why did the agent do this?" A side drawer over the mission page.
export default function ExplainDrawer({ explanation, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!explanation) return;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [explanation, onClose]);

  const agent = explanation && AGENT_BY_ID[explanation.agent];
  const confidence = agent?.confidence;

  return (
    <AnimatePresence>
      {explanation && (
        <motion.div className="fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="explain-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="absolute right-0 inset-y-0 w-full sm:w-[440px] bg-[#0e0c15] border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col"
          >
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#eb6920]/10 rounded-full blur-3xl pointer-events-none" />

            <header className="relative flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-white/5">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#eb6920] mb-1">Why did the agent do this?</div>
                <div className="flex items-center gap-2.5">
                  <AgentIcon id={explanation.agent} />
                  <div className="min-w-0">
                    <h2 id="explain-title" className="text-base font-bold text-white">
                      {agentName(explanation.agent)}
                    </h2>
                    <div className="text-[11px] text-gray-500">
                      {agent?.role || 'Mission coordinator'}
                      {explanation.t != null && (
                        <span className="font-mono">
                          {' '}· {explanation.at ? `${formatTime(explanation.at)} · ` : ''}T+{formatClock(explanation.t)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close explanation"
                className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6920]/60"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="relative flex-1 overflow-y-auto px-6">
              <Section icon={Zap} label={explanation.kind === 'task' ? 'Task' : 'Action'}>
                <p className="text-sm font-semibold text-white leading-relaxed">{explanation.action}</p>
              </Section>
              <Section icon={Target} label="Objective">
                <p className="text-sm text-gray-200 leading-relaxed">{explanation.objective}</p>
              </Section>
              <Section icon={Lightbulb} label="Reason">
                <p className="text-sm text-gray-200 leading-relaxed">{explanation.reason}</p>
              </Section>
              <Section icon={FileSearch} label="Evidence from this mission">
                {explanation.evidence.length === 0 ? (
                  <p className="text-xs text-gray-500">No related mission data yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {explanation.evidence.map((ev, i) => (
                      <li key={i} className="rounded-xl bg-black/40 border border-white/5 px-3 py-2">
                        <div className="text-[10px] text-gray-500 mb-0.5">
                          {ev.label}
                          {ev.agent && <span style={{ color: AGENT_BY_ID[ev.agent]?.color }}> · {agentName(ev.agent)}</span>}
                        </div>
                        <div className="text-xs text-gray-300 leading-relaxed">{ev.value}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              {explanation.usedInputs && explanation.usedInputs.length > 0 && (
                <Section icon={GitBranch} label="Used from earlier steps">
                  <div className="space-y-2">
                    {explanation.usedInputs.map((input, i) => (
                      <div key={i} className="rounded-xl bg-black/40 border border-white/5 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-semibold text-white">
                            {input.label || input.key}
                          </span>
                          {input.fromApp && <AppBadge appId={input.fromApp} size="sm" />}
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                          <span>From step:</span>
                          <span className="text-gray-300 font-medium truncate">{input.fromStepTitle}</span>
                        </div>
                        <div className="text-xs font-mono text-[#ff9a5c] bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5 break-all">
                          {input.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {confidence != null && (
                <Section icon={Gauge} label="Confidence">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${confidence * 100}%`, background: agent.color }} />
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums">{Math.round(confidence * 100)}%</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">The agent’s configured confidence in this demo, not a live model score.</p>
                </Section>
              )}
              <Section icon={ArrowRight} label={explanation.kind === 'task' ? 'Unlocks next' : 'What happened next'}>
                {explanation.next ? (
                  <div className="flex items-start gap-2.5">
                    <AgentIcon id={explanation.next.agent} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold" style={{ color: AGENT_BY_ID[explanation.next.agent]?.color || '#9ca3af' }}>
                        {agentName(explanation.next.agent)}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{explanation.next.text}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{explanation.kind === 'task' ? 'Nothing depends on this task.' : 'This is the latest step so far.'}</p>
                )}
              </Section>
            </div>

            <footer className="relative px-6 py-4 border-t border-white/5 text-[10px] text-gray-600 leading-relaxed">
              Explanations in this demo are written alongside the mission script and filled in from live mission data. They are not
              generated by a language model.
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
