import React from 'react';
import { ArrowRight, CheckCircle2, GitBranch, MousePointerClick, ShieldCheck, Sparkles, X } from 'lucide-react';
import { SectionLabel } from '../components/ui';

const CAPABILITIES = [
  {
    icon: GitBranch,
    title: 'Plans',
    text: 'Turns one sentence into a task graph with dependencies, owners and a clear definition of done.',
  },
  {
    icon: MousePointerClick,
    title: 'Acts',
    text: 'Works through tools: email, forms and a browser agent that clicks, types and publishes. The live demo runs a scripted simulation.',
  },
  {
    icon: ShieldCheck,
    title: 'Asks first',
    text: 'Pauses before anything risky, like emails, payments and submissions. You approve, reject or edit.',
  },
  {
    icon: CheckCircle2,
    title: 'Verifies',
    text: 'Doesn’t trust its own output. It counts, dedupes and checks the result until the goal is really met.',
  },
];

function Comparison() {
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-5">A chatbot</div>
        <div className="space-y-3">
          <div className="ml-auto w-fit max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-white/[0.06] text-sm text-gray-200">
            Create a Google Form.
          </div>
          <div className="w-fit max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/5 text-sm text-gray-400">
            Sure! Here are 6 steps to create a form yourself…
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <X className="w-4 h-4 text-red-400" />
          You still do the work.
        </div>
      </div>

      <div className="featured-card rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#eb6920]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#eb6920] mb-5">AgentOS</div>
          <div className="ml-auto w-fit max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[#eb6920]/20 text-sm text-white">
            Get 100 registrations for our hackathon.
          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-300">
            {['Builds and publishes the form', 'Emails 480 past attendees, after you approve', 'Recovers when Discord blocks the post', 'Verifies 104 real sign-ups'].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <ArrowRight className="w-3.5 h-3.5 text-[#eb6920] shrink-0" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2 text-sm text-white font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Outcome delivered.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Difference() {
  return (
    <section className="py-24 relative">
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <SectionLabel icon={Sparkles}>Outcomes, not answers</SectionLabel>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">Not a chatbot. A workforce.</h2>
          <p className="text-gray-400 text-sm sm:text-base mt-4">
            Assistants tell you how to do things. AgentOS does them, and keeps going until the goal is met.
          </p>
        </div>

        <Comparison />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="grid gap-4 md:col-span-2 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="glass-card rounded-3xl p-6">
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#eb6920] mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Recovery gets the spotlight: it's the feature that makes the rest trustworthy. */}
          <div className="glass-card rounded-3xl relative overflow-hidden flex flex-col p-6">
            <div className="relative w-full h-52 flex items-center justify-center overflow-hidden rounded-2xl bg-[#09080d]">
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(235,105,32,0.95) 0%, rgba(255,140,66,0.6) 35%, rgba(235,105,32,0.1) 75%, transparent 100%)',
                  clipPath: 'polygon(15% 0%, 85% 0%, 65% 100%, 35% 100%)',
                  filter: 'blur(2px)',
                }}
              />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-12 bg-[#ff9724] blur-xl opacity-90" />
              <div className="relative z-10 mt-10 w-20 h-20 rounded-3xl bg-[#14121a]/95 border-2 border-[#eb6920] shadow-[0_0_40px_rgba(235,105,32,0.7)] flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-white shadow-[0_0_12px_#ffffff]" />
                  <div className="absolute -top-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                  <div className="absolute -bottom-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                  <div className="absolute -left-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                  <div className="absolute -right-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#eb6920] mb-1.5">The superpower</div>
              <h3 className="text-xl font-bold text-white mb-1.5">Recovers</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                When something breaks, AgentOS finds the cause, builds a new plan and retries. No human needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
