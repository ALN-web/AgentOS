import React from 'react';
import { ArrowRight, Play, Sparkles, ChevronDown, CheckCircle2, TrendingUp } from 'lucide-react';

export default function Hero({ onOpenMissionModal, onOpenDemoModal }) {
  const brandLogos = [
    { name: 'Trace', icon: '◎' },
    { name: 'Volume', icon: '♫' },
    { name: 'Clues', icon: '✦' },
    { name: 'Rise', icon: '⚑' },
    { name: 'Trace', icon: '◎' },
    { name: 'Clues', icon: '✦' },
    { name: 'Cloud', icon: '☁' }
  ];

  const agentImports = [
    { name: 'Hype', role: 'Planner Agent', color: 'from-purple-500 to-pink-500' },
    { name: 'Penta', role: 'Research Agent', color: 'from-blue-500 to-cyan-500' },
    { name: 'Border', role: 'Execution Agent', color: 'from-cyan-400 to-emerald-400' }
  ];

  const monthlyBars = [
    { month: 'Dec', h1: 45, h2: 25 },
    { month: 'Jan', h1: 20, h2: 30 },
    { month: 'Feb', h1: 32, h2: 36 },
    { month: 'Mar', h1: 18, h2: 24 },
    { month: 'Apr', h1: 38, h2: 28 },
    { month: 'May', h1: 20, h2: 30 },
    { month: 'Jun', h1: 42, h2: 34 }
  ];

  return (
    <section id="home" className="relative pt-32 pb-20 overflow-hidden">
      {/* Background ambient orange radial glow from top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#eb6920]/20 via-[#eb6920]/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-[1240px] mx-auto px-6">
        {/* Top Tagline Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(235,105,32,0.15)] hover:border-[#eb6920]/40 transition-all">
            <span className="w-2 h-2 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920] animate-pulse" />
            <span className="text-xs md:text-sm font-medium text-gray-300">
              Don't tell AI what to do. Tell it what you want done.
            </span>
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            Autonomous AI <br />
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              Workforce
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 font-normal leading-relaxed max-w-2xl mx-auto">
            Turn goals into completed outcomes through planning, execution, verification, recovery, and autonomous multi-agent collaboration.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={onOpenMissionModal}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold tracking-wide uppercase bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_25px_rgba(235,105,32,0.45)] hover:shadow-[0_0_35px_rgba(235,105,32,0.8)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Launch Mission</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={onOpenDemoModal}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold tracking-wide text-gray-200 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/25 backdrop-blur-md transition-all flex items-center justify-center gap-2.5"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#eb6920]" />
            <span>Watch Demo</span>
          </button>
        </div>

        {/* Upper Dashboard Mockup (Matching Frame 00:00 - 00:01 in video) */}
        <div className="max-w-4xl mx-auto glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] mb-16">
          {/* Subtle warm orange edge gradient */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#eb6920]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Import data into Front Dashboard */}
            <div className="bg-[#0b0910] border border-white/5 rounded-2xl p-5">
              <div className="mb-4">
                <h3 className="text-xs md:text-sm font-semibold text-gray-200">
                  Import data into Front Dashboard
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  See and talk to your autonomous agents immediately
                </p>
              </div>

              <div className="space-y-3">
                {agentImports.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${item.color} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                        {item.name[0]}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-200 group-hover:text-[#eb6920] transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-gray-400">{item.role}</div>
                      </div>
                    </div>
                    <button className="text-[11px] font-medium text-gray-400 hover:text-white px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] transition-colors">
                      Launch importer
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                <span className="text-[11px] font-medium text-gray-400 hover:text-white cursor-pointer flex items-center gap-1">
                  Action <span className="text-[#eb6920]">&gt;</span>
                </span>
              </div>
            </div>

            {/* Right Card: Monthly task execution chart */}
            <div className="bg-[#0b0910] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs md:text-sm font-semibold text-gray-200">
                    Monthly mission throughput
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 bg-white/[0.04] px-2 py-1 rounded border border-white/5 cursor-pointer">
                    <span>This week</span>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>

                {/* Y-axis indicator numbers */}
                <div className="flex justify-between text-[10px] text-gray-400 mb-2 px-1">
                  <span>100</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>

                {/* Vertical Bar Chart matching video */}
                <div className="h-32 flex items-end justify-between gap-2 pt-2 px-2 border-b border-white/10">
                  {monthlyBars.map((b, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex justify-center items-end gap-1 h-24">
                        {/* Orange Bar */}
                        <div
                          style={{ height: `${b.h1}%` }}
                          className="w-2.5 bg-gradient-to-t from-[#eb6920] to-[#ff8c42] rounded-t-sm shadow-[0_0_8px_rgba(235,105,32,0.4)] transition-all hover:brightness-125"
                        />
                        {/* Dark Bar */}
                        <div
                          style={{ height: `${b.h2}%` }}
                          className="w-2 bg-[#2d221c] rounded-t-sm"
                        />
                      </div>
                      <span className="text-[9px] text-gray-400">{b.month}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="font-semibold">+34.8% efficiency</span>
                </div>
                <span className="text-gray-400">99.98% recovery SLA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Logo Cloud Section (Frame 00:00 - 00:01 in video) */}
        <div className="text-center pt-2">
          <p className="text-xs md:text-sm font-medium text-gray-400 mb-8">
            Join 4,000+ companies already growing
          </p>

          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-75 grayscale hover:grayscale-0 transition-all">
            {brandLogos.map((brand, idx) => (
              <div key={idx} className="flex items-center gap-2 group cursor-pointer">
                <span className="text-base text-gray-400 group-hover:text-[#eb6920] transition-colors">
                  {brand.icon}
                </span>
                <span className="text-sm font-bold tracking-wider text-gray-400 group-hover:text-white transition-colors">
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
