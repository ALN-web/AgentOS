import React, { useState, useEffect } from 'react';
import { X, Play, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Loader2, Sparkles, Terminal } from 'lucide-react';

export default function LaunchMissionModal({ isOpen, onClose, initialTemplate }) {
  const [goal, setGoal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (initialTemplate) {
      setGoal(`Execute ${initialTemplate.name}: ${initialTemplate.tagline}. Goal: ${initialTemplate.description}`);
    }
  }, [initialTemplate]);

  if (!isOpen) return null;

  const missionSteps = [
    { title: 'Goal Received', agent: 'System Core', msg: 'Goal ingested and constraints tokenized.' },
    { title: 'Decomposing Plan', agent: 'Planner Agent', msg: 'Synthesizing DAG execution tree across 4 parallel workers.' },
    { title: 'Research & Grounding', agent: 'Research Agent', msg: 'Extracting live API schemas and policy documentation.' },
    { title: 'Sandboxed Execution', agent: 'Execution Agent', msg: 'Executing subagent scripts in ephemeral container #9142.' },
    { title: 'Outcome Verification', agent: 'Verification Agent', msg: 'Running invariant assertions & visual regression tests: 100% PASS.' },
    { title: 'Self-Healing Check', agent: 'Recovery Agent', msg: 'Zero runtime exceptions detected. Checkpoint state committed.' },
    { title: 'Human Approval Check', agent: 'Approval Agent', msg: 'Action within autonomous safety boundary. Auto-cleared.' },
    { title: 'Mission Complete', agent: 'Mission Orchestrator', msg: 'Target outcome reached. Artifacts delivered successfully.' }
  ];

  const handleRun = () => {
    if (!goal.trim()) return;
    setIsRunning(true);
    setCurrentStep(0);
    setLogs([`[00:00:01] Direct Goal: "${goal.slice(0, 60)}..."`]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < missionSteps.length) {
        setCurrentStep(step);
        const item = missionSteps[step];
        setLogs((prev) => [...prev, `[00:00:0${step * 2}] [${item.agent}] ${item.msg}`]);
      } else {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl bg-[#0e0c15] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden">
        
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#eb6920]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#eb6920]/10 border border-[#eb6920]/20 text-[11px] font-bold text-[#eb6920] mb-2 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Autonomous Mission Dispatch</span>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            Launch AgentOS Mission
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            "Don't tell AI what to do. Tell it what you want done."
          </p>
        </div>

        {/* Goal Input Area */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Desired Outcome / Goal
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Audit all customer subscriptions, file refund claims for inactive seats, and output verified CSV."
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb6920]/60 resize-none shadow-inner"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {['DeadlineOS', 'RecoveryOS', 'EventRescue'].map((tName) => (
                <button
                  key={tName}
                  type="button"
                  onClick={() => setGoal(`Deploy ${tName} to resolve active operational bottlenecks.`)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/5 transition-colors"
                >
                  +{tName}
                </button>
              ))}
            </div>

            <button
              onClick={handleRun}
              disabled={isRunning || !goal.trim()}
              className="px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_20px_rgba(235,105,32,0.45)] hover:shadow-[0_0_30px_rgba(235,105,32,0.7)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Swarm Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Launch Swarm</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Multi-Agent Execution Telemetry */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-300 border-b border-white/5 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#eb6920]" />
              <span>Telemetry Terminal</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">
              {isRunning ? '● LIVE SWARM' : currentStep === missionSteps.length - 1 ? '✔ COMPLETED' : 'IDLE'}
            </span>
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {missionSteps.map((step, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx <= currentStep && isRunning || idx <= currentStep && currentStep === missionSteps.length - 1
                    ? 'bg-[#eb6920] shadow-[0_0_8px_#eb6920]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Log Stream */}
          <div className="h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-gray-400">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic py-8 text-center">
                Enter your desired outcome and launch the autonomous swarm.
              </div>
            ) : (
              logs.map((log, lIdx) => (
                <div key={lIdx} className="text-gray-300">
                  <span className="text-[#eb6920] font-semibold">{log.slice(0, 10)}</span>
                  <span>{log.slice(10)}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
