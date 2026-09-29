import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { AgentIcon, ProgressBar, StatusPill, agentName } from '../components/ui';
import { useMissions } from '../store/MissionStore';
import { DEMO_GOAL } from '../data/templates';

// A looping, condensed replay of the demo mission.
const PREVIEW = [
  { agent: 'planner', text: 'Plan ready: 7 tasks, 2 running in parallel.', count: 0, status: 'running' },
  { agent: 'research', text: 'Found 480 past attendees and 3 student clubs.', count: 0, status: 'running' },
  { agent: 'browser', text: 'Registration form is live.', count: 0, status: 'running' },
  { agent: 'approval', text: 'You approved the email to 480 people.', count: 41, status: 'running' },
  { agent: 'browser', text: 'Discord rejected the post: links are blocked.', count: 41, status: 'recovering', tone: 'fail' },
  { agent: 'recovery', text: 'Posted a QR-code image instead. Pinned.', count: 76, status: 'running', tone: 'fix' },
  { agent: 'verification', text: '104 unique, valid registrations. Goal met.', count: 104, status: 'completed', tone: 'ok' },
];

function MissionPreview() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = step >= PREVIEW.length - 1;
    const id = setTimeout(() => setStep(done ? 0 : step + 1), done ? 3500 : 1500);
    return () => clearTimeout(id);
  }, [step]);

  const current = PREVIEW[step];
  const visible = PREVIEW.slice(Math.max(0, step - 3), step + 1);

  return (
    <div className="max-w-3xl mx-auto glass-card rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#eb6920]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/5">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Mission</div>
          <div className="text-sm sm:text-base font-semibold text-white truncate">{DEMO_GOAL}</div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <StatusPill status={current.status} />
          <div className="text-right">
            <div className="text-2xl font-extrabold text-white tabular-nums leading-none">
              {current.count}
              <span className="text-sm text-gray-500 font-semibold">/100</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">registrations</div>
          </div>
        </div>
      </div>

      <div className="relative pt-4">
        <ProgressBar value={current.count} target={100} />
      </div>

      <div className="relative mt-5 h-[212px] overflow-hidden">
        <AnimatePresence initial={false}>
          {visible.map((line, i) => {
            const idx = Math.max(0, step - 3) + i;
            const tone =
              line.tone === 'fail'
                ? 'border-red-500/30 bg-red-500/[0.06]'
                : line.tone === 'fix'
                ? 'border-[#eb6920]/40 bg-[#eb6920]/[0.07]'
                : line.tone === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                : 'border-white/5 bg-white/[0.02]';
            return (
              <motion.div
                key={idx}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.35 }}
                className={`flex items-center gap-3 p-2.5 mb-2 rounded-xl border ${tone}`}
              >
                <AgentIcon id={line.agent} size="sm" />
                <span className="text-[11px] font-semibold text-gray-400 w-28 shrink-0 hidden sm:block">{agentName(line.agent)}</span>
                <span className="text-xs text-gray-200 truncate">{line.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

const STEPS = ['Give AgentOS a goal.', 'Agents execute the work.', 'AgentOS handles failure.', 'AgentOS verifies the outcome.'];

export default function Hero() {
  const { openLauncher, startDemo } = useMissions();
  const navigate = useNavigate();

  const runDemo = () => navigate(`/app/missions/${startDemo()}`);

  return (
    <section id="home" className="relative pt-36 pb-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-[#eb6920]/20 via-[#eb6920]/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-[1240px] mx-auto px-6">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#eb6920] shadow-[0_0_8px_#eb6920] animate-pulse" />
            <span className="text-xs md:text-sm font-medium text-gray-300">
              Don’t tell AI what to do. Tell it what you want done.
            </span>
          </div>
        </div>

        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.05] mb-6">
            Your autonomous <br />
            <span className="bg-gradient-to-r from-[#ffb37a] via-[#ff8c42] to-[#eb6920] bg-clip-text text-transparent">AI workforce</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto">
            Give AgentOS a goal. Eight agents plan it, do the work, fix what breaks, and prove it’s done.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
          <button
            onClick={() => openLauncher(DEMO_GOAL)}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold tracking-wide uppercase btn-orange flex items-center justify-center gap-2 group"
          >
            Launch Mission
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={runDemo}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold tracking-wide btn-dark flex items-center justify-center gap-2.5"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#eb6920]" />
            Try Demo Mission
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 mb-10">
          Runs entirely in your browser as a simulation. No sign-up, no API keys, nothing is sent anywhere.
        </p>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 max-w-4xl mx-auto mb-14" aria-label="How AgentOS works">
          {STEPS.map((text, i) => (
            <li key={text} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="w-7 h-7 rounded-full bg-[#eb6920]/15 border border-[#eb6920]/40 text-[#ff9a5c] text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-200 font-medium leading-snug">{text}</span>
            </li>
          ))}
        </ol>

        <MissionPreview />
      </div>
    </section>
  );
}
