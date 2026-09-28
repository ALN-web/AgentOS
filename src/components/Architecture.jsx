import React, { useState } from 'react';
import { Target, Cpu, Globe, Terminal, CheckCircle2, RotateCcw, UserCheck, Flag, ArrowRight, Sparkles } from 'lucide-react';

export default function Architecture() {
  const [activeStep, setActiveStep] = useState(1);

  const pipeline = [
    {
      id: 'goal',
      title: 'Goal',
      role: 'Directive Input',
      icon: Target,
      desc: 'Unstructured natural language request or mission trigger.',
      detail: 'Inputs can be prompt strings, webhooks, scheduled triggers, or incoming error events. The directive defines target constraints without requiring procedural steps.'
    },
    {
      id: 'planner',
      title: 'Planner',
      role: 'Planner Agent',
      icon: Cpu,
      desc: 'Deconstructs goal into an optimized DAG execution tree.',
      detail: 'Analyzes intent, estimates token and compute budgets, identifies dependencies, and schedules parallel streams with strict validation criteria.'
    },
    {
      id: 'research',
      title: 'Research',
      role: 'Research Agent',
      icon: Globe,
      desc: 'Extracts ground truth from web, APIs, and documentation.',
      detail: 'Scrapes live endpoints, searches web indices, reads technical specifications, and synthesizes grounded context into working memory.'
    },
    {
      id: 'execution',
      title: 'Execution',
      role: 'Execution Agent',
      icon: Terminal,
      desc: 'Executes commands, code, scripts, and browser interactions.',
      detail: 'Sandboxed code execution, browser DOM manipulation, API payloads, and file system mutations with atomic commit capabilities.'
    },
    {
      id: 'verification',
      title: 'Verification',
      role: 'Verification Agent',
      icon: CheckCircle2,
      desc: 'Cryptographically verifies results against goal constraints.',
      detail: 'Automated unit and integration tests, schema validation, visual DOM diffing, and formal invariant checks. Rejects invalid output.'
    },
    {
      id: 'recovery',
      title: 'Recovery',
      role: 'Recovery Agent',
      icon: RotateCcw,
      desc: 'Self-diagnoses failures and triggers surgical state rollbacks.',
      detail: 'Captures stack traces and error signals, formulates root-cause hypotheses, rolls back intermediate state, and branches alternate strategies.'
    },
    {
      id: 'approval',
      title: 'Approval',
      role: 'Approval Agent',
      icon: UserCheck,
      desc: 'Enforces human-in-the-loop policies for high-stakes actions.',
      detail: 'Presents structured diffs, financial transactions, or deployment checkpoints for explicit human authorization before execution.'
    },
    {
      id: 'complete',
      title: 'Mission Complete',
      role: 'Final Outcome',
      icon: Flag,
      desc: 'Verified delivery of production-ready outcomes and reports.',
      detail: 'Final artifacts committed, logs archived, metrics reported, and downstream notifications dispatched with complete audit provenance.'
    }
  ];

  return (
    <section id="architecture" className="py-24 relative overflow-hidden">
      {/* Background orange radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#eb6920]/10 rounded-full blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-[1240px] mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold uppercase tracking-wider text-[#eb6920] mb-3">
            <Sparkles className="w-3 h-3" />
            <span>Autonomous Pipeline</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Autonomous Architecture
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto">
            From natural language intent to completed, verified outcome through our deterministic 8-stage collaborative agent pipeline.
          </p>
        </div>

        {/* Pipeline Diagram Flow */}
        <div className="glass-card p-8 sm:p-10 rounded-3xl border border-white/10 mb-10 relative overflow-hidden">
          
          {/* Horizontal Conduit Line */}
          <div className="hidden lg:block absolute top-[72px] left-12 right-12 h-0.5 bg-gradient-to-r from-[#eb6920]/30 via-[#eb6920] to-[#eb6920]/30 z-0" />

          {/* Grid of Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 relative z-10">
            {pipeline.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`flex flex-col items-center text-center cursor-pointer group transition-all duration-300 ${
                    isActive ? 'scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* Step Circle */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all mb-3 ${
                    isActive
                      ? 'bg-gradient-to-tr from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_25px_rgba(235,105,32,0.6)] border-2 border-white/20 ring-4 ring-[#eb6920]/30'
                      : 'bg-[#14111c] text-gray-400 group-hover:text-white border border-white/10 group-hover:border-[#eb6920]/50'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title & Role */}
                  <div className="text-xs font-bold text-white group-hover:text-[#eb6920] transition-colors">
                    {step.title}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                    {step.role}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Step Details Panel */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="bg-[#0b0911] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#eb6920]/20 text-[#eb6920] border border-[#eb6920]/30">
                    Stage {activeStep + 1} of 8
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    {pipeline[activeStep].title} — {pipeline[activeStep].role}
                  </h3>
                </div>
                <p className="text-sm text-gray-300">
                  {pipeline[activeStep].desc}
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {pipeline[activeStep].detail}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : pipeline.length - 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 border border-white/10 transition-colors"
                >
                  Prev Stage
                </button>
                <button
                  onClick={() => setActiveStep((prev) => (prev < pipeline.length - 1 ? prev + 1 : 0))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#eb6920] hover:bg-[#ff8c42] text-white shadow-[0_0_15px_rgba(235,105,32,0.4)] transition-all flex items-center gap-1.5"
                >
                  <span>Next Stage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
