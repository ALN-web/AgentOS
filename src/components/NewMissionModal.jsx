import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Info, Lock, ShieldAlert, Sparkles, Target, X, Mic, Square, AlertCircle } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useMissions } from '../store/MissionStore';
import { usePreferences } from '../store/PreferencesStore';
import { EXAMPLE_GOALS } from '../data/templates';
import { planMission } from '../agentos/planner';
import { CAPABILITY_BY_ID } from '../agentos/capabilities';
import { AgentIcon, agentName } from './ui';

const RISK_TONE = {
  low: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  medium: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  high: 'text-red-300 border-red-400/30 bg-red-400/10',
};

function Stat({ value, label }) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/5 px-3 py-2.5">
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

// "Mission understood": what AgentOS made of the goal, before anything runs.
function Understanding({ goal, answers, setAnswers, preferences }) {
  const [showPlan, setShowPlan] = useState(false);
  // Questions come from the goal alone, so answering one doesn't hide it mid-typing.
  const questions = useMemo(() => planMission(goal, {}, undefined, preferences).intent.questions, [goal, preferences]);
  const plan = useMemo(() => planMission(goal, answers, undefined, preferences), [goal, answers, preferences]);
  const { intent } = plan;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-[#eb6920]/30 bg-[#150f0b] p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#eb6920]">
            <Check className="w-3 h-3" />
            Mission understood
          </span>
          <span className="text-[10px] font-semibold text-gray-400 px-2 py-0.5 rounded-full border border-white/10">{intent.domainLabel}</span>
        </div>
        <div className="text-base font-bold text-white">{intent.objective}</div>
        <div className="flex items-start gap-1.5 text-xs text-gray-300 mt-1.5">
          <Target className="w-3.5 h-3.5 mt-0.5 text-[#ff9a5c] shrink-0" />
          <span>
            <span className="text-gray-500">Success means: </span>
            {intent.desiredOutcome}
          </span>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Likely capabilities</div>
        <div className="flex flex-wrap gap-1.5">
          {plan.capabilities.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] text-gray-200">
              <Check className="w-3 h-3 text-emerald-400" />
              {CAPABILITY_BY_ID[c]?.name}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Estimated execution plan</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat value={plan.tasks.length} label="tasks" />
          <Stat value={plan.approvalPoints} label={plan.approvalPoints === 1 ? 'approval point' : 'approval points'} />
          <Stat value={plan.criteria.length} label="success criteria" />
          <div className="rounded-xl bg-black/40 border border-white/5 px-3 py-2.5 flex flex-col justify-center">
            <span className={`self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${RISK_TONE[plan.riskLevel]}`}>{plan.riskLevel}</span>
            <span className="text-[10px] text-gray-500 mt-1">risk</span>
          </div>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs font-semibold text-white mb-0.5">A few details would sharpen the plan</div>
          <p className="text-[11px] text-gray-500 mb-3">Optional. Anything you skip uses the assumption below. The plan updates as you answer.</p>
          <div className="space-y-2.5">
            {questions.map((q) => (
              <label key={q.id} className="block">
                <span className="text-[11px] text-gray-300">{q.question}</span>
                {q.options ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {q.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [q.id]: answers[q.id] === o ? '' : o })}
                        aria-pressed={answers[q.id] === o}
                        className={`px-3 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                          answers[q.id] === o ? 'border-[#eb6920]/50 bg-[#eb6920]/15 text-white' : 'border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder={q.placeholder}
                    className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#eb6920]/60"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {plan.assumptions.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-gray-400">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
          <span>
            <span className="text-gray-500">Assuming: </span>
            {plan.assumptions.join(' · ')}
          </span>
        </div>
      )}

      {intent.applied_preferences && intent.applied_preferences.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-[#eb6920]">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold opacity-80">Using your preferences: </span>
            {intent.applied_preferences.map(key => {
              if (key === 'timezone') return preferences?.timezone;
              if (key === 'working_hours') return `${preferences?.workingHours?.start}–${preferences?.workingHours?.end}`;
              if (key === 'working_days') return preferences?.workingDays?.length === 5 && !preferences.workingDays.includes('Saturday') && !preferences.workingDays.includes('Sunday') ? 'Monday–Friday' : preferences?.workingDays?.join(', ');
              if (key === 'meeting_length') return `${preferences?.meetingLength}m meeting`;
              if (key === 'team_group') return Object.values(preferences?.groups || {}).find(g => g.name.toLowerCase() === intent.recipient?.toLowerCase())?.name || intent.recipient;
              if (key === 'tone') return `${preferences?.tone} tone`;
              if (key === 'signature') return 'Signature';
              return key;
            }).filter(Boolean).join(' · ')}
          </span>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowPlan((v) => !v)}
          aria-expanded={showPlan}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#eb6920] hover:text-[#ff9a5c]"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPlan ? 'rotate-180' : ''}`} />
          {showPlan ? 'Hide plan' : 'Review plan'}
        </button>
        <AnimatePresence initial={false}>
          {showPlan && (
            <motion.ol
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 space-y-1.5 overflow-hidden"
            >
              {plan.tasks.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2.5 rounded-xl bg-black/40 border border-white/5 px-3 py-2">
                  <span className="text-[10px] font-mono text-gray-600 w-4 text-right">{i + 1}</span>
                  <AgentIcon id={t.agent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white truncate">{t.title}</div>
                    <div className="text-[10px] text-gray-500">{agentName(t.agent)}</div>
                  </div>
                  {t.gated && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 shrink-0">
                      <Lock className="w-3 h-3" />
                      Approval
                    </span>
                  )}
                </li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>

      <p className="flex items-start gap-1.5 text-[10px] text-gray-600">
        <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
        {plan.kind === 'hero'
          ? 'Curated demo plan. Every action runs as a simulation.'
          : 'Planned by the demo planner: deterministic goal analysis in your browser, no API key. Every action runs as a simulation.'}
      </p>
    </div>
  );
}

export default function NewMissionModal() {
  const { launcher, launch, closeLauncher } = useMissions();
  const { preferences } = usePreferences();
  const [goal, setGoal] = useState('');
  const [stage, setStage] = useState('input'); // 'input' | 'review'
  const [answers, setAnswers] = useState({});
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleSpeechResult = useCallback((transcript) => {
    setGoal((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${transcript}` : transcript;
    });
  }, []);

  const { supported: speechSupported, listening: speechListening, error: speechError, interimText, start: startSpeech, stop: stopSpeech } = useSpeechRecognition({
    onResult: handleSpeechResult
  });

  useEffect(() => {
    if (launcher.open) {
      setGoal(launcher.goal);
      setStage('input');
      setAnswers({});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [launcher.open, launcher.goal]);

  useEffect(() => {
    if (!launcher.open) return;
    const onKey = (e) => e.key === 'Escape' && closeLauncher();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launcher.open, closeLauncher]);

  const ready = goal.trim().length > 2;

  const analyze = (e) => {
    e?.preventDefault();
    if (!ready) return;
    setAnswers({});
    setStage('review');
  };

  const start = () => {
    if (!ready) return;
    const id = launch(goal, { plan: planMission(goal.trim(), answers, undefined, preferences) });
    navigate(`/app/missions/${id}`);
  };

  return (
    <AnimatePresence>
      {launcher.open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && closeLauncher()}
        >
          <motion.form
            onSubmit={stage === 'input' ? analyze : (e) => (e.preventDefault(), start())}
            role="dialog"
            aria-modal="true"
            aria-labelledby="launcher-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[#0e0c15] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)]"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#eb6920]/15 rounded-full blur-3xl pointer-events-none" />

            <button
              type="button"
              onClick={closeLauncher}
              aria-label="Close"
              className="absolute top-5 right-5 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#eb6920] uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" />
                Start any mission
              </div>
              <h3 id="launcher-title" className="text-2xl font-bold text-white tracking-tight pr-10">
                What do you want AgentOS to accomplish?
              </h3>

              {stage === 'input' ? (
                <>
                  <p className="text-sm text-gray-400 mt-1">Describe the outcome in your own words. AgentOS works out the plan.</p>
                  <div className="relative mt-5">
                    <textarea
                      ref={inputRef}
                      rows={3}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) analyze(e);
                      }}
                      aria-label="Mission goal"
                      placeholder="e.g. Organize a hackathon in our college"
                      className={`w-full bg-black/60 border rounded-2xl p-4 pr-14 text-sm text-white placeholder-gray-500 focus:outline-none resize-none transition-colors ${
                        speechListening ? 'border-[#eb6920]/60 ring-1 ring-[#eb6920]/30' : 'border-white/10 focus:border-[#eb6920]/60'
                      }`}
                    />
                    
                    {speechSupported && (
                      <div className="absolute right-3 bottom-3 flex items-center">
                        {speechListening ? (
                          <button
                            type="button"
                            onClick={stopSpeech}
                            aria-label="Stop voice input"
                            className="p-2 rounded-full bg-[#eb6920]/20 text-[#eb6920] hover:bg-[#eb6920]/30 transition-colors animate-pulse"
                            title="Stop recording"
                          >
                            <Square className="w-4 h-4 fill-current" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={startSpeech}
                            aria-label="Start voice input"
                            className="p-2 rounded-full bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors"
                            title="Start voice input"
                          >
                            <Mic className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {interimText && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-gray-400 px-1">
                      <Mic className="w-3.5 h-3.5 text-[#eb6920] shrink-0 mt-0.5 animate-pulse" />
                      <span className="italic truncate">{interimText}</span>
                    </div>
                  )}

                  {speechError && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400 px-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{speechError === 'not-allowed' ? 'Microphone permission denied.' : 'Voice recognition error.'}</span>
                    </div>
                  )}

                  {speechSupported && (
                     <div className="mt-2 text-[10px] text-gray-600 px-1">
                       Voice input uses your browser's native speech recognition.
                     </div>
                  )}
                  <div className="mt-3">
                    <div className="text-[10px] text-gray-500 mb-1.5">Examples, or type anything:</div>
                    <div className="flex flex-wrap gap-2">
                      {EXAMPLE_GOALS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGoal(g)}
                          className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/5 transition-colors text-left"
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-gray-500 hidden sm:block">Enter to analyze · Esc to close</span>
                    <div className="flex gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={start}
                        disabled={!ready}
                        className="btn-dark px-4 py-2.5 rounded-full text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        Start mission
                      </button>
                      <button
                        type="submit"
                        disabled={!ready}
                        className="btn-orange px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        Analyze goal
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mt-1 truncate">“{goal.trim()}”</p>
                  <Understanding goal={goal.trim()} answers={answers} setAnswers={setAnswers} preferences={preferences} />
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setStage('input')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Edit goal
                    </button>
                    <button type="submit" className="btn-orange px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                      Start mission
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
