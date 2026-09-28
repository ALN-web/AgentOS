import React, { useState } from 'react';
import { ArrowRight, ChevronDown, CheckCircle, TrendingUp, Layers, Activity } from 'lucide-react';

export default function CtaDashboard({ onOpenMissionModal }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('Analytics');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setEmail('');
      }, 4000);
    }
  };

  const navTabs = ['Analytics', 'Products', 'Users', 'Campaigns'];

  const metrics = [
    { label: 'TOTAL AGENTS', val: '72,350', change: '+5.9%', path: 'M0,18 Q15,12 25,15 T50,8 T75,12 T100,5' },
    { label: 'CONSENSUS', val: '28.4%', change: '+12.1%', path: 'M0,15 Q20,10 40,14 T80,6 T100,8' },
    { label: 'RECOVERY', val: '38.8%', change: '+8.4%', path: 'M0,16 Q25,8 50,15 T75,7 T100,4' },
    { label: 'THROUGHPUT', val: '56.8%', change: '+18.3%', path: 'M0,14 Q30,12 60,6 T100,2' }
  ];

  const tableRows = [
    { name: 'Hype', role: 'Planner Swarm', color: 'from-purple-500 to-pink-500' },
    { name: 'Penta', role: 'Research Swarm', color: 'from-blue-500 to-cyan-500' },
    { name: 'Border', role: 'Execution Swarm', color: 'from-emerald-400 to-cyan-500' }
  ];

  const monthlyBars = [
    { h1: 45, h2: 25 },
    { h1: 20, h2: 30 },
    { h1: 32, h2: 36 },
    { h1: 18, h2: 24 },
    { h1: 38, h2: 28 },
    { h1: 20, h2: 30 },
    { h1: 42, h2: 34 }
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6">
        
        {/* Giant Dark Container matching video Frame 00:17 - 00:19 */}
        <div className="rounded-3xl bg-[#09080e] border border-white/10 p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
          
          {/* Intense Ambient Orange Glow at bottom edge matching video */}
          <div className="absolute -bottom-24 left-1/4 right-1/4 h-48 bg-gradient-to-t from-[#eb6920] to-transparent blur-[90px] opacity-70 pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            
            {/* Left Column: Heading, Subtitle & Email Input Form */}
            <div className="lg:col-span-5 space-y-6">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Transform Your Work with AgentOS
              </h2>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Embark on a transformative journey of autonomous execution with AgentOS. Eliminate manual bottlenecks forever.
              </p>

              {/* Form matching video */}
              <form onSubmit={handleSubmit} className="pt-2">
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-black/60 p-1.5 rounded-full border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email here"
                    className="w-full sm:flex-1 bg-transparent px-5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_20px_rgba(235,105,32,0.45)] hover:shadow-[0_0_30px_rgba(235,105,32,0.7)] hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                  >
                    Get Started
                  </button>
                </div>
                {submitted && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Invite dispatched! Check your inbox.</span>
                  </div>
                )}
              </form>
            </div>

            {/* Right Column: Mini Dashboard Card (Exact match to video Frame 00:17 - 00:19) */}
            <div className="lg:col-span-7 bg-[#0f0d15] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              
              {/* Internal Dashboard Nav */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold tracking-wider text-white">AGENT</span>
                  <span className="text-xs font-extrabold text-[#eb6920]">OS</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#eb6920]" />
                </div>

                <div className="flex items-center gap-4">
                  {navTabs.map((tab) => (
                    <span
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-[11px] cursor-pointer font-medium transition-colors ${
                        activeTab === tab ? 'text-white border-b-2 border-[#eb6920] pb-1' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {tab}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dashboard Title & Sparkline Metric Cards */}
              <div className="mb-5">
                <h3 className="text-sm font-bold text-white mb-3 tracking-wide">
                  Dashboard
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {metrics.map((m, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                      <div className="flex justify-between items-center text-[9px] text-gray-400 font-semibold mb-1">
                        <span>{m.label}</span>
                        <span className="text-emerald-400 font-mono">{m.change}</span>
                      </div>
                      <div className="text-sm sm:text-base font-bold text-white mb-1">
                        {m.val}
                      </div>
                      <div className="h-4 w-full">
                        <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                          <path d={m.path} fill="none" stroke="#eb6920" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lower Section: Table + Monthly Expenses Bar Chart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Table: Import data into Front Dashboard */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-200 mb-1">
                      Import data into Front Dashboard
                    </div>
                    <div className="text-[10px] text-gray-400 mb-3">
                      See and talk to your agents immediately
                    </div>

                    <div className="space-y-2">
                      {tableRows.map((r, rIdx) => (
                        <div key={rIdx} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-md bg-gradient-to-tr ${r.color} flex items-center justify-center text-[9px] font-bold text-white`}>
                              {r.name[0]}
                            </div>
                            <div>
                              <span className="text-gray-200 text-[11px] font-medium block">{r.name}</span>
                              <span className="text-gray-400 text-[9px] block">{r.role}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded bg-white/[0.04]">
                            Launch importer
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 text-right">
                    <span className="text-[10px] font-medium text-gray-400 hover:text-white cursor-pointer">
                      Action <span className="text-[#eb6920]">&gt;</span>
                    </span>
                  </div>
                </div>

                {/* Monthly tasks bar chart with orange bars */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-200">
                      Monthly throughput
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-white/[0.04] px-1.5 py-0.5 rounded">
                      This week <ChevronDown className="w-2.5 h-2.5" />
                    </span>
                  </div>

                  {/* Bars */}
                  <div className="h-28 flex items-end justify-between gap-1.5 px-2 border-b border-white/5 pb-2">
                    {monthlyBars.map((b, bIdx) => (
                      <div key={bIdx} className="flex-1 flex justify-center items-end gap-0.5 h-full">
                        <div
                          style={{ height: `${b.h1}%` }}
                          className="w-2 bg-gradient-to-t from-[#eb6920] to-[#ff8c42] rounded-t-sm shadow-[0_0_6px_rgba(235,105,32,0.4)]"
                        />
                        <div
                          style={{ height: `${b.h2}%` }}
                          className="w-1.5 bg-[#2a222c] rounded-t-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-between text-[10px] text-gray-400">
                    <span>Active swarm: 99.9%</span>
                    <span className="text-emerald-400 font-semibold">+34% growth</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
