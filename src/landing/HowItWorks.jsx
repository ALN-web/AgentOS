import React, { useState } from 'react';
import { CheckCircle2, Cpu, Flag, Globe, RotateCcw, Target, Terminal, UserCheck, Workflow } from 'lucide-react';
import { SectionLabel } from '../components/ui';

const STAGES = [
  { icon: Target, title: 'Goal', text: 'You describe the outcome in one sentence.', example: '“Get 100 registrations for our hackathon.”' },
  { icon: Cpu, title: 'Plan', text: 'The Planner builds a task graph and assigns each task to an agent.', example: '7 tasks. The form and the invite email run in parallel.' },
  { icon: Globe, title: 'Research', text: 'The Research agent gathers the facts the plan depends on.', example: 'Finds 480 past attendees and 3 active student clubs.' },
  { icon: Terminal, title: 'Execute', text: 'Execution and Browser agents do the work with real tools.', example: 'Publishes a Google Form and drafts the invite.' },
  { icon: UserCheck, title: 'Approve', text: 'Anything risky pauses until you approve, reject or edit it.', example: '“Email 480 people from events@?” You approve.' },
  { icon: RotateCcw, title: 'Recover', text: 'Failures are diagnosed and worked around automatically.', example: 'Discord blocks links, so it posts a QR-code image instead.' },
  { icon: CheckCircle2, title: 'Verify', text: 'The Verification agent checks the result against the goal.', example: 'Removes 8 duplicates and bad emails, then sends a reminder.' },
  { icon: Flag, title: 'Complete', text: 'The mission ends only when the outcome is verified.', example: '104 of 100 registrations. Done.' },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const stage = STAGES[active];

  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden scroll-mt-20">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#eb6920]/10 rounded-full blur-[150px] pointer-events-none -z-10" />

      <div className="max-w-[1240px] mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <SectionLabel icon={Workflow}>How it works</SectionLabel>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">From goal to done</h2>
          <p className="text-sm sm:text-base text-gray-400">Every mission follows the same loop. Here’s the demo mission, step by step.</p>
        </div>

        <div className="glass-card p-6 sm:p-10 rounded-3xl relative overflow-hidden">
          <div className="hidden lg:block absolute top-[68px] left-16 right-16 h-px bg-gradient-to-r from-[#eb6920]/20 via-[#eb6920]/70 to-[#eb6920]/20" />

          <div className="grid grid-cols-4 lg:grid-cols-8 gap-y-6 gap-x-2 relative">
            {STAGES.map(({ icon: Icon, title }, idx) => {
              const isActive = active === idx;
              const isPast = idx < active;
              return (
                <button key={title} onClick={() => setActive(idx)} className="flex flex-col items-center text-center group">
                  <span
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all mb-3 ${
                      isActive
                        ? 'bg-gradient-to-tr from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_25px_rgba(235,105,32,0.6)] ring-4 ring-[#eb6920]/25'
                        : isPast
                        ? 'bg-[#1b1310] text-[#eb6920] border border-[#eb6920]/40'
                        : 'bg-[#14111c] text-gray-500 border border-white/10 group-hover:text-white group-hover:border-[#eb6920]/50'
                    }`}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </span>
                  <span className={`text-xs font-bold transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>{title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 grid md:grid-cols-2 gap-6 items-center">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#eb6920] mb-2">
                Step {active + 1} of {STAGES.length}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{stage.title}</h3>
              <p className="text-sm sm:text-base text-gray-300">{stage.text}</p>
            </div>
            <div className="rounded-2xl bg-black/40 border border-white/5 p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">In the demo mission</div>
              <p className="text-sm text-gray-200">{stage.example}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
