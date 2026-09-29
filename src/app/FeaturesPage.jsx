import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Lock, Plug } from 'lucide-react';
import { CAPABILITIES } from '../agentos/capabilities';
import { AgentIcon, agentName } from '../components/ui';
import { FEATURES } from '../data/features';
import FeatureCard from '../components/FeatureCard';
import { useMissions } from '../store/MissionStore';

const LOOP = ['Goal', 'Plan', 'Execute', 'Approve', 'Recover', 'Verify', 'Outcome'];

export default function FeaturesPage() {
  const { missions, startDemo, openLauncher } = useMissions();
  const navigate = useNavigate();

  const see = (target) => {
    if (target.to) return navigate(target.to);
    if (target.launcher) return openLauncher('');
    if (target.replay) {
      const completed = missions.filter((m) => m.status === 'completed');
      const done = completed.find((m) => /registration/i.test(m.goal)) || completed[0];
      if (done) return navigate(`/app/missions/${done.id}`);
    }
    navigate(`/app/missions/${startDemo()}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Features</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-2xl">
          Everything AgentOS does to turn a goal into a verified outcome. Each capability links to where you can see it working.
        </p>
      </div>

      <div className="glass-card rounded-2xl px-4 sm:px-6 py-4 mb-6 overflow-x-auto no-scrollbar">
        <ol className="flex items-center gap-1.5 min-w-max" aria-label="The mission loop">
          {LOOP.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              <span
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
                  step === 'Recover'
                    ? 'border-red-400/30 bg-red-400/10 text-red-300'
                    : step === 'Outcome'
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-[#eb6920]/25 bg-[#eb6920]/[0.07] text-[#ff9a5c]'
                }`}
              >
                {step}
              </span>
              {i < LOOP.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <FeatureCard key={f.id} feature={f} onSee={see} />
        ))}
      </div>

      <section className="mt-10" aria-labelledby="registry">
        <h2 id="registry" className="text-lg font-bold text-white">Capability registry</h2>
        <p className="text-sm text-gray-400 mt-1 mb-4 max-w-2xl">
          The planner chooses capabilities, not scripts. Each capability belongs to an agent. In this demo every capability runs a
          simulated tool; real APIs, MCP servers or a browser can be registered behind the same capability later.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {CAPABILITIES.map((c) => (
            <div key={c.id} className="glass-card rounded-2xl p-4 flex gap-3">
              <AgentIcon id={c.agent} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{c.name}</div>
                <div className="text-[11px] text-gray-500 mb-1.5">{agentName(c.agent)}</div>
                <p className="text-xs text-gray-400 leading-relaxed">{c.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.external && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-amber-400/30 bg-amber-400/10 text-[10px] font-semibold text-amber-300">
                      <Lock className="w-2.5 h-2.5" />
                      Needs approval
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded-md border border-white/10 text-[10px] text-gray-400">Demo tool: simulated</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-white/5 text-[10px] text-gray-600">
                    <Plug className="w-2.5 h-2.5" />
                    Live tool: not connected
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
