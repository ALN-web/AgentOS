import React, { useState } from 'react';
import { ArrowRight, Check, Shield, Activity, Terminal, Globe, CheckCircle2, AlertOctagon, RotateCcw, UserCheck, MessageSquare, Cpu } from 'lucide-react';

// Default list of 8 agents as mandated by specifications
export const DEFAULT_AGENT_FEATURES = [
  {
    id: 'planner',
    name: 'Planner Agent',
    icon: Cpu,
    tag: 'Macro Orchestration',
    headlineRow1: 'Top Management, to help you see the bigger picture',
    descriptionRow1: 'Breaks down unstructured user directives into verified multi-step dependency graphs, ensuring optimal resource allocation and parallel execution paths.',
    row1Checks: [
      'Customizable layouts for efficient agent orchestration.',
      'Runtime preferences to match your execution constraints.',
      'Create multiple agent profiles for multi-domain versatility.'
    ],
    headlineRow2: 'Helping you with fast-reading plans on the go',
    descriptionRow2: 'Dynamic DAG recomputation adapting in real time to emergent environmental roadblocks, tool timeouts, and changing external requirements.',
    row2Checks: [
      'Topological sorting with dependency isolation.',
      'Automatic critical-path prioritization.',
      'Deterministic milestone verification contracts.'
    ],
    metricValue: '99.4%',
    metricLabel: 'Plan Feasibility Score'
  },
  {
    id: 'research',
    name: 'Research Agent',
    icon: Globe,
    tag: 'Autonomous Synthesis',
    headlineRow1: 'Deep Intelligence, to extract ground truth across the web',
    descriptionRow1: 'Autonomous multi-source research engine that scrapes, parses, cross-references, and synthesizes complex documentation, APIs, and real-time feeds.',
    row1Checks: [
      'High-throughput web crawling and markdown parsing.',
      'Fact-checking cross-verification against authoritative domains.',
      'Zero-hallucination semantic memory embedding.'
    ],
    headlineRow2: 'Helping you with synthesized citations on the go',
    descriptionRow2: 'Extract actionable intelligence from dense academic papers, legal documents, and sprawling codebases within sub-second latency.',
    row2Checks: [
      'Automatic primary source citation indexing.',
      'Noise-filtering relevance re-ranking.',
      'Dynamic entity relationship graphs.'
    ],
    metricValue: '12.4x',
    metricLabel: 'Information Retrieval Speed'
  },
  {
    id: 'execution',
    name: 'Execution Agent',
    icon: Terminal,
    tag: 'Deterministic Runtime',
    headlineRow1: 'Precision Execution, to turn code into verified reality',
    descriptionRow1: 'Executes shell commands, scripts, file system modifications, and API calls within secure, isolated sandboxes with zero host contamination.',
    row1Checks: [
      'Sandboxed ephemeral execution containers.',
      'Granular tool permission management.',
      'Live streaming stdout/stderr telemetry.'
    ],
    headlineRow2: 'Helping you with blazing execution speeds on the go',
    descriptionRow2: 'Deterministic command dispatch with automated environment setup, dependency resolution, and atomic state commits.',
    row2Checks: [
      'Sub-millisecond container spinup times.',
      'Atomic rollback on command non-zero exit.',
      'Native support for multi-language runtimes.'
    ],
    metricValue: '45ms',
    metricLabel: 'Mean Command Latency'
  },
  {
    id: 'browser',
    name: 'Browser Agent',
    icon: Activity,
    tag: 'Headless Navigation',
    headlineRow1: 'Web Interaction, to navigate any web application',
    descriptionRow1: 'Performs complex visual workflows: multi-factor authentication, DOM element manipulation, file uploads, and cross-application data synchronization.',
    row1Checks: [
      'Vision-guided DOM tree traversal and interaction.',
      'Automatic CAPTCHA detection and token handling.',
      'Full-page viewport rendering and snapshot validation.'
    ],
    headlineRow2: 'Helping you with automated web operations on the go',
    descriptionRow2: 'Interact with legacy enterprise portals, modern SPAs, and third-party SaaS dashboards without relying on existing API integrations.',
    row2Checks: [
      'Autonomous session state and cookie preservation.',
      'Resilient retry logic on dynamic DOM mutations.',
      'High-speed headless Chromium orchestration.'
    ],
    metricValue: '99.8%',
    metricLabel: 'Workflow Success Rate'
  },
  {
    id: 'verification',
    name: 'Verification Agent',
    icon: CheckCircle2,
    tag: 'Deterministic QA',
    headlineRow1: 'Quality Assurance, to validate every completed milestone',
    descriptionRow1: 'Conducts formal verification of generated code, artifacts, and API responses against strict user-defined invariant constraints.',
    row1Checks: [
      'Automated test suite generation and execution.',
      'Schema compliance and type-safety audits.',
      'Pixel-perfect visual regression testing.'
    ],
    headlineRow2: 'Helping you with verifiable proof on the go',
    descriptionRow2: 'Never accept unverified claims. Every mission outcome must pass through automated verification checkpoints before moving to completion.',
    row2Checks: [
      'Cryptographic outcome state hashing.',
      'Multi-angle automated integration testing.',
      'Independent validation benchmark scoring.'
    ],
    metricValue: '100%',
    metricLabel: 'Contract Compliance'
  },
  {
    id: 'critic',
    name: 'Critic Agent',
    icon: AlertOctagon,
    tag: 'Adversarial Review',
    headlineRow1: 'Adversarial Rigor, to uncover subtle failure points',
    descriptionRow1: 'Simulates edge cases, adversarial inputs, and unintended side-effects to pressure-test solutions before production deployment.',
    row1Checks: [
      'Automated boundary condition fuzz testing.',
      'Logical fallacy and premise contradiction detection.',
      'Worst-case performance and complexity audits.'
    ],
    headlineRow2: 'Helping you with bulletproof robustness on the go',
    descriptionRow2: 'Expose hidden assumptions and edge cases that standard testing overlooks, improving overall system resilience.',
    row2Checks: [
      'Counter-example generation against user goals.',
      'Resource exhaustion and vulnerability detection.',
      'Constructive patch recommendation pipeline.'
    ],
    metricValue: '0.01%',
    metricLabel: 'Post-Deployment Defects'
  },
  {
    id: 'recovery',
    name: 'Recovery Agent',
    icon: RotateCcw,
    tag: 'Self-Healing Engine',
    headlineRow1: 'Self-Healing Core, to recover from any runtime error',
    descriptionRow1: 'Intercepts unhandled exceptions, network drops, or rate limits, diagnosing root causes and applying surgical runtime rollbacks automatically.',
    row1Checks: [
      'Automated root-cause telemetry stack inspection.',
      'Context-aware alternative execution pathing.',
      'Zero-downtime micro-state rollback.'
    ],
    headlineRow2: 'Helping you with autonomous resilience on the go',
    descriptionRow2: 'Turn brittle AI scripts into unbreakable mission-critical engines that self-diagnose and heal without human intervention.',
    row2Checks: [
      'Exponential backoff and smart rate-limit management.',
      'Dynamic prompt & code repair reflection loops.',
      'Telemetry-guided persistent healing records.'
    ],
    metricValue: '98.7%',
    metricLabel: 'Autonomous Recovery Rate'
  },
  {
    id: 'approval',
    name: 'Approval Agent',
    icon: UserCheck,
    tag: 'Human-in-the-Loop',
    headlineRow1: 'Governance & Safety, to retain executive oversight',
    descriptionRow1: 'Manages sensitive action thresholds, high-risk financial transfers, and deployment approvals through clean interactive human checkpoints.',
    row1Checks: [
      'Configurable risk tier thresholding.',
      'Interactive Slack/Telegram/Web confirmation modals.',
      'Immutable audit trails and governance logs.'
    ],
    headlineRow2: 'Helping you with trusted oversight on the go',
    descriptionRow2: 'Maintain total control over critical transactions while letting autonomous swarms handle 99% of routine operations.',
    row2Checks: [
      'One-click biometric authorization.',
      'Granular blast-radius sandboxing.',
      'Complete cryptographic replay audits.'
    ],
    metricValue: '0.00%',
    metricLabel: 'Unauthorized Actions'
  }
];

// Reusable component accepting custom features list for future expansion
export default function Features({ features = DEFAULT_AGENT_FEATURES }) {
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [activeTabRight, setActiveTabRight] = useState('sessions');

  const current = features[activeAgentIndex] || features[0];

  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-[#eb6920]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-96 h-96 bg-[#eb6920]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-[1240px] mx-auto px-6">
        {/* Main Centered Section Header matching video */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Features
          </h2>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Explore the frontier of autonomous intelligence with AgentOS. Our specialized agents redefine the boundaries of what's possible in multi-agent execution.
          </p>
        </div>

        {/* Reusable Agent Selector (8 Feature Cards as requested) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-16 no-scrollbar justify-start lg:justify-center">
          {features.map((agent, idx) => {
            const Icon = agent.icon;
            const isSelected = activeAgentIndex === idx;
            return (
              <button
                key={agent.id}
                onClick={() => setActiveAgentIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_20px_rgba(235,105,32,0.45)] scale-105'
                    : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{agent.name}</span>
              </button>
            );
          })}
        </div>

        {/* FEATURE ROW 1 (Frame 00:04 - 00:07 in video) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
          
          {/* Left Column: Text & Checkmarks */}
          <div className="space-y-6">
            <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-snug">
              {current.headlineRow1}
            </h3>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              {current.descriptionRow1}
            </p>

            {/* See Doc Button matching video */}
            <div>
              <button className="btn-dark px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider flex items-center gap-2 group">
                <span>See Doc</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#eb6920] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* 3 Checkmark Items matching video */}
            <div className="space-y-3 pt-2">
              {current.row1Checks.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-[#eb6920] flex items-center justify-center text-white shadow-[0_0_8px_#eb6920]">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="text-xs sm:text-sm text-gray-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Layered Interactive Glass Card with Metallic Rings & Shield */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl relative overflow-hidden border border-white/10 group">
            
            {/* Top Interactive Tabs: Sessions vs Live Chat (Frame 00:04) */}
            <div className="flex items-center gap-3 mb-8">
              {/* Sessions Tab */}
              <div 
                onClick={() => setActiveTabRight('sessions')}
                className={`flex-1 p-3.5 rounded-2xl cursor-pointer transition-all border ${
                  activeTabRight === 'sessions'
                    ? 'bg-black/60 border-[#eb6920]/60 shadow-[0_0_20px_rgba(235,105,32,0.25)]'
                    : 'bg-black/30 border-white/5 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#eb6920] to-[#ff8c42] flex items-center justify-center text-white shadow-sm">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Sessions</div>
                    <div className="text-[10px] text-gray-400">Autonomous loop active</div>
                  </div>
                </div>
              </div>

              {/* Live Chat Tab */}
              <div 
                onClick={() => setActiveTabRight('chat')}
                className={`flex-1 p-3.5 rounded-2xl cursor-pointer transition-all border ${
                  activeTabRight === 'chat'
                    ? 'bg-black/60 border-[#eb6920]/60 shadow-[0_0_20px_rgba(235,105,32,0.25)]'
                    : 'bg-black/30 border-white/5 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-gray-300">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Live Chat</div>
                    <div className="text-[10px] text-gray-400">Direct agent interface</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Concentric Metallic Orbit Rings with Glowing Shield Emblem (Exact Replica of Video Frame 00:04 - 00:07) */}
            <div className="relative w-full h-72 rounded-2xl bg-[#09080e] overflow-hidden flex items-center justify-center border border-white/5">
              
              {/* Ambient Orange Radar Arc */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(235,105,32,0.25)_0%,_transparent_70%)]" />

              {/* Concentric Metallic Rings */}
              <div className="absolute w-80 h-80 rounded-full border border-white/[0.06]" />
              <div className="absolute w-64 h-64 rounded-full border border-[#eb6920]/30 shadow-[0_0_30px_rgba(235,105,32,0.15)]" />
              <div className="absolute w-48 h-48 rounded-full border border-white/[0.12] bg-[#121019]" />
              <div className="absolute w-36 h-36 rounded-full border-2 border-[#eb6920]/40 bg-gradient-to-tr from-[#1b1724] to-[#0c0a11] shadow-[inset_0_0_20px_rgba(235,105,32,0.3)]" />

              {/* Center Metallic White Shield Icon */}
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-[0_0_35px_rgba(255,255,255,0.7)] group-hover:scale-110 transition-transform">
                <Shield className="w-9 h-9 text-[#0e0c14] fill-current" />
              </div>

              {/* Bottom status badge */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[11px]">
                <span className="text-gray-400">Active Consensus</span>
                <span className="text-[#eb6920] font-mono font-bold">100% Deterministic</span>
              </div>
            </div>

          </div>

        </div>

        {/* FEATURE ROW 2 (Alternating Layout, Frame 00:08 - 00:10 in video) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Column: Dark Card with Glowing Orange Graph (Frame 00:08 - 00:10) */}
          <div className="glass-card p-6 sm:p-8 rounded-3xl relative overflow-hidden border border-white/10 group order-2 lg:order-1">
            
            {/* Top Badge: Charts always ON! */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#eb6920] to-[#ff8c42] flex items-center justify-center text-white shadow-[0_0_15px_rgba(235,105,32,0.5)]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Telemetry always ON!</h4>
                  <p className="text-[11px] text-gray-400">Real-time goal trajectory & anomalies</p>
                </div>
              </div>
            </div>

            {/* Glowing Orange Chart Card matching video */}
            <div className="relative w-full h-64 rounded-2xl bg-[#09080e] overflow-hidden flex flex-col justify-between p-5 border border-white/5">
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-medium">Autonomous Throughput</span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Healthy
                </span>
              </div>

              {/* Glowing Floating Orange Metric Card (Exact from video) */}
              <div className="my-auto mx-auto w-full max-w-[280px] p-4 rounded-2xl bg-gradient-to-br from-[#eb6920] to-[#ff7d2b] shadow-[0_0_35px_rgba(235,105,32,0.7)] text-white flex items-center justify-between group-hover:scale-105 transition-transform">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    Velocity Rate
                  </div>
                  <div className="text-2xl font-black tracking-tight">
                    28.4% <span className="text-sm font-bold">▲</span>
                  </div>
                </div>

                {/* Mini Wave SVG */}
                <div className="w-20 h-8">
                  <svg className="w-full h-full" viewBox="0 0 60 20" preserveAspectRatio="none">
                    <path
                      d="M0,15 Q15,5 30,12 T60,4"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-gray-400 border-t border-white/5 pt-3">
                <span>Checkpoint Recovery: 0.12s</span>
                <span>{current.metricLabel}: <strong className="text-white">{current.metricValue}</strong></span>
              </div>
            </div>

          </div>

          {/* Right Column: Text & Checkmarks */}
          <div className="space-y-6 order-1 lg:order-2">
            <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-snug">
              {current.headlineRow2}
            </h3>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              {current.descriptionRow2}
            </p>

            {/* See Doc Button */}
            <div>
              <button className="btn-dark px-5 py-2.5 rounded-full text-xs font-semibold tracking-wider flex items-center gap-2 group">
                <span>See Doc</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#eb6920] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* 3 Checkmark Items */}
            <div className="space-y-3 pt-2">
              {current.row2Checks.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-[#eb6920] flex items-center justify-center text-white shadow-[0_0_8px_#eb6920]">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="text-xs sm:text-sm text-gray-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
