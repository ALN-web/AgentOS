import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { FEATURES } from '../data/features';
import FeatureCard from '../components/FeatureCard';
import { useMissions } from '../store/MissionStore';

const LOOP = ['Goal', 'Plan', 'Execute', 'Approve', 'Recover', 'Verify', 'Outcome'];

export default function FeaturesPage() {
  const { missions, startDemo } = useMissions();
  const navigate = useNavigate();

  const see = (target) => {
    if (target.to) return navigate(target.to);
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
    </div>
  );
}
