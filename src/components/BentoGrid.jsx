import React, { useState } from 'react';
import { Sparkles, TrendingUp, Wand2, Shield, Layers, Bot, Zap, ArrowUpRight } from 'lucide-react';

export default function BentoGrid({ onOpenMissionModal }) {
  const [activeTaskTab, setActiveTaskTab] = useState('Personal');

  const taskTabs = [
    { name: 'Personal', count: '12 active' },
    { name: 'Issues', count: '0 errors' },
    { name: 'Active', count: '8 agents' },
    { name: 'Backlog', count: '24 queued' },
    { name: 'Projects', count: '5 running' }
  ];

  return (
    <section id="agents" className="py-20 relative">
      <div className="max-w-[1240px] mx-auto px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold uppercase tracking-wider text-[#eb6920] mb-3">
            <Zap className="w-3 h-3" />
            <span>Agent Workforce</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Coordinated Multi-Agent Intelligence
          </h2>
          <p className="text-gray-400 text-sm sm:text-base mt-2">
            Every agent operates in an isolated sandbox with shared memory, deterministic verification, and automated self-healing.
          </p>
        </div>

        {/* Bento Grid Layout matching video Frame 00:00 - 00:03 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Column 1 (Left): Balance Card & AI Sessions */}
          <div className="flex flex-col gap-6">
            {/* Card 1: Balance / Execution Velocity */}
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:border-[#eb6920]/40 transition-all">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Autonomous Velocity
                </h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Continuous goal execution with autonomous checkpoint recovery and distributed state preservation.
              </p>

              {/* Action tags matching video buttons */}
              <div className="space-y-3">
                {/* Active Orange Glowing Tag (like PER-06) */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-[#eb6920] to-[#ff8c42] text-white shadow-[0_0_20px_rgba(235,105,32,0.4)] cursor-pointer group-hover:scale-[1.02] transition-transform">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/25 uppercase tracking-wider">
                      AG-01
                    </span>
                    <span className="text-xs font-semibold">
                      Autonomous dispatch active
                    </span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                </div>

                {/* Secondary Tag (like PER-07) */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-gray-300 hover:bg-white/[0.08] hover:border-white/10 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-400 px-1.5 py-0.5 rounded bg-white/[0.04] uppercase tracking-wider">
                      AG-02
                    </span>
                    <span className="text-xs font-medium">
                      Create self-healing prototype
                    </span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                </div>
              </div>
            </div>

            {/* Card 4: AI Sessions */}
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:border-[#eb6920]/40 transition-all flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Agent Sessions
                </h3>
                <span className="text-[11px] font-medium text-[#eb6920] bg-[#eb6920]/10 px-2 py-0.5 rounded-full border border-[#eb6920]/20">
                  Live
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Isolated runtime environments executing parallel multi-step missions with zero cross-contamination.
              </p>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-xs font-bold text-[#eb6920]">
                    ⚡
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-200">Sandbox #4092</div>
                    <div className="text-[10px] text-gray-400">Memory sync: 12ms</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono text-emerald-400">99.98%</span>
                  <div className="text-[9px] text-gray-400">Deterministic</div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2 (Middle): Users Card & Interactive Checklist */}
          <div className="flex flex-col gap-6">
            {/* Card 2: Users / Total Active Swarms */}
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:border-[#eb6920]/40 transition-all">
              <h3 className="text-lg font-bold text-white tracking-wide mb-2">
                Active Workforce
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Real-time agent swarm coordination across enterprise workflows and cloud toolchains.
              </p>

              {/* Total Users Metric Box matching video */}
              <div className="p-4 rounded-2xl bg-[#09080e] border border-white/10 relative overflow-hidden group-hover:border-[#eb6920]/30 transition-all">
                <div className="flex justify-between items-center text-gray-400 text-[10px] font-semibold tracking-wider uppercase mb-1">
                  <span>TOTAL AGENTS</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <TrendingUp className="w-3 h-3" />
                    5.9%
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  72,350
                </div>

                {/* Animated sparkline svg matching video */}
                <div className="mt-3 h-8 w-full">
                  <svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sparklineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#eb6920" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#eb6920" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,20 Q20,15 35,18 T70,8 T100,12"
                      fill="none"
                      stroke="#eb6920"
                      strokeWidth="2"
                    />
                    <path
                      d="M0,20 Q20,15 35,18 T70,8 T100,12 L100,25 L0,25 Z"
                      fill="url(#sparklineGrad)"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 5: Interactive Task Checklist with Magic Wand (Matching video) */}
            <div className="glass-card p-6 rounded-3xl relative overflow-hidden group hover:border-[#eb6920]/40 transition-all flex-1 flex flex-col justify-between">
              <div className="relative z-10">
                <div className="space-y-2">
                  {taskTabs.map((tab) => {
                    const isActive = activeTaskTab === tab.name;
                    return (
                      <div
                        key={tab.name}
                        onClick={() => setActiveTaskTab(tab.name)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs transition-all ${
                          isActive
                            ? 'bg-white/[0.08] text-white font-semibold border border-white/10 shadow-sm'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full transition-colors ${
                            isActive ? 'bg-[#eb6920] shadow-[0_0_8px_#eb6920]' : 'bg-white/20'
                          }`} />
                          <span>{tab.name}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {tab.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Floating Magic Wand & Star Cluster Illustration (Exact visual from video) */}
              <div className="absolute right-4 bottom-4 pointer-events-none opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Glowing star burst */}
                  <div className="absolute -top-1 right-2 text-white/90 animate-pulse text-lg">✦</div>
                  <div className="absolute top-6 left-1 text-white/70 text-sm">✧</div>
                  <div className="absolute bottom-2 right-6 text-[#eb6920] text-xl">✦</div>

                  {/* Magic Wand icon representation */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md flex items-center justify-center rotate-12 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    <Wand2 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3 (Right): Tall Spotlight Funnel Card with Glowing Emblem (Matching Video Frame 00:00 - 00:03) */}
          <div className="glass-card rounded-3xl relative overflow-hidden group hover:border-[#eb6920]/50 transition-all flex flex-col justify-between p-6">
            
            {/* Top Inverted Orange Funnel of Glowing Light */}
            <div className="relative w-full h-64 flex items-center justify-center overflow-hidden rounded-2xl bg-[#09080d]">
              {/* Funnel Beam Gradient */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-56 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(235,105,32,0.95) 0%, rgba(255,140,66,0.6) 35%, rgba(235,105,32,0.1) 75%, transparent 100%)',
                  clipPath: 'polygon(15% 0%, 85% 0%, 65% 100%, 35% 100%)',
                  filter: 'blur(2px)'
                }}
              />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-12 bg-[#ff9724] blur-xl opacity-90" />

              {/* Glowing AgentOS Nexus Emblem (Exact match to central icon in video) */}
              <div className="relative z-10 mt-12 w-20 h-20 rounded-3xl bg-[#14121a]/95 border-2 border-[#eb6920] shadow-[0_0_40px_rgba(235,105,32,0.7)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <div className="relative flex items-center justify-center">
                  {/* Central Node and interconnected satellites */}
                  <div className="w-5 h-5 rounded-full bg-white shadow-[0_0_12px_#ffffff]" />
                  <div className="absolute -top-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                  <div className="absolute -bottom-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                  <div className="absolute -left-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                  <div className="absolute -right-4 w-2.5 h-2.5 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920]" />
                </div>
              </div>
            </div>

            {/* Bottom Content: Create / Goal-to-outcome synthesis */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white tracking-wide">
                  Create
                </h3>
                <button
                  onClick={onOpenMissionModal}
                  className="p-2 rounded-xl bg-white/[0.05] hover:bg-[#eb6920] hover:text-white text-gray-400 transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                Turn natural language directives into executable multi-agent contracts. Just state your desired outcome.
              </p>

              <button
                onClick={onOpenMissionModal}
                className="w-full py-3 rounded-2xl text-xs font-semibold tracking-wider uppercase bg-white/[0.04] hover:bg-[#eb6920] text-gray-200 hover:text-white border border-white/10 hover:border-transparent transition-all shadow-sm hover:shadow-[0_0_20px_rgba(235,105,32,0.5)]"
              >
                Synthesize New Goal
              </button>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
