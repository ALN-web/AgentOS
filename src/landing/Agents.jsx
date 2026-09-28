import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Users } from 'lucide-react';
import { AGENTS } from '../data/agents';
import { AgentIcon, SectionLabel } from '../components/ui';

export default function Agents() {
  const [activeId, setActiveId] = useState(AGENTS[0].id);
  const agent = AGENTS.find((a) => a.id === activeId);

  return (
    <section id="agents" className="py-24 relative overflow-hidden scroll-mt-20">
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-[#eb6920]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-[1240px] mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <SectionLabel icon={Users}>The workforce</SectionLabel>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">Eight agents. One team.</h2>
          <p className="text-sm sm:text-base text-gray-400">
            Each agent has one job. Together they plan, act, check each other’s work and recover from failure.
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar lg:justify-center">
          {AGENTS.map((a) => {
            const Icon = a.icon;
            const selected = a.id === activeId;
            return (
              <button
                key={a.id}
                onClick={() => setActiveId(a.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selected
                    ? 'bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_20px_rgba(235,105,32,0.45)]'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {a.name}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="grid lg:grid-cols-2 gap-6 items-stretch"
          >
            <div className="glass-card rounded-3xl p-6 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-5">
                <AgentIcon id={agent.id} size="lg" />
                <div>
                  <h3 className="text-2xl font-bold text-white">{agent.name} Agent</h3>
                  <p className="text-sm text-gray-400">{agent.role}</p>
                </div>
              </div>
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed mb-6">{agent.description}</p>
              <ul className="space-y-3">
                {agent.capabilities.map((c) => (
                  <li key={c} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-4 h-4 rounded bg-[#eb6920] flex items-center justify-center text-white shadow-[0_0_8px_#eb6920]">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-card rounded-3xl p-6 sm:p-10 relative overflow-hidden flex flex-col justify-center">
              <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{ background: `radial-gradient(ellipse at 70% 30%, ${agent.color}22 0%, transparent 60%)` }}
              />
              <div className="relative">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-4">In the demo mission</div>
                <div className="flex items-start gap-3">
                  <AgentIcon id={agent.id} />
                  <div className="flex-1 px-4 py-3 rounded-2xl rounded-tl-md bg-black/50 border border-white/10">
                    <div className="text-[11px] font-semibold mb-1" style={{ color: agent.color }}>
                      {agent.name} Agent
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed">{agent.sample}</p>
                  </div>
                </div>
                <div className="mt-8 flex items-center justify-between text-xs text-gray-400 border-t border-white/5 pt-4">
                  <span>Typical confidence</span>
                  <span className="font-mono text-white">{Math.round(agent.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
