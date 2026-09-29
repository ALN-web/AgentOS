import React, { useState } from 'react';
import { Brain, ChevronDown, Info, Target } from 'lucide-react';
import { CAPABILITY_BY_ID } from '../../agentos/capabilities';

// What AgentOS understood the goal to be, and how it decided to approach it.
export default function MissionBrief({ plan }) {
  const [open, setOpen] = useState(true);
  if (!plan) return null;
  const { intent } = plan;

  return (
    <div className="glass-card rounded-2xl p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-sm font-semibold text-white"
      >
        <span className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#eb6920]" />
          Mission understanding
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-semibold text-gray-300">{intent.domainLabel}</span>
            <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px] text-gray-400">
              {plan.tasks.length} tasks · {plan.approvalPoints} approval{plan.approvalPoints === 1 ? '' : 's'} · {plan.riskLevel} risk
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-gray-300">
            <Target className="w-3.5 h-3.5 mt-0.5 text-[#ff9a5c] shrink-0" />
            <span>
              <span className="text-gray-500">Success means: </span>
              {intent.desiredOutcome}
            </span>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Capabilities used</div>
            <div className="flex flex-wrap gap-1">
              {plan.capabilities.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-[10px] text-gray-300">
                  {CAPABILITY_BY_ID[c]?.name}
                </span>
              ))}
            </div>
          </div>
          {plan.assumptions.length > 0 && (
            <div className="flex items-start gap-1.5 text-gray-400">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
              <span>
                <span className="text-gray-500">Assumed: </span>
                {plan.assumptions.join(' · ')}
              </span>
            </div>
          )}
          <p className="text-[10px] text-gray-600">
            {plan.kind === 'hero'
              ? 'Curated demo plan for the hero mission. Actions are simulated.'
              : 'Planned by the demo planner (deterministic, in your browser). Actions are simulated.'}
          </p>
        </div>
      )}
    </div>
  );
}
