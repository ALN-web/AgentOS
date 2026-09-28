import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { DEMO_GOAL } from '../data/templates';

export default function FinalCta() {
  const { launch } = useMissions();
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');

  const submit = (e) => {
    e.preventDefault();
    navigate(`/app/missions/${launch(goal.trim() || DEMO_GOAL)}`);
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="rounded-3xl bg-[#09080e] border border-white/10 px-6 py-16 sm:px-12 sm:py-20 relative overflow-hidden text-center">
          <div className="absolute -bottom-24 left-1/4 right-1/4 h-48 bg-gradient-to-t from-[#eb6920] to-transparent blur-[90px] opacity-70 pointer-events-none" />

          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Give it a goal.
              <br />
              Watch it get done.
            </h2>
            <p className="text-sm sm:text-base text-gray-400 mt-4">Type an outcome, or press launch to run the demo mission.</p>

            <form
              onSubmit={submit}
              className="mt-8 flex flex-col sm:flex-row items-stretch gap-2 bg-black/60 p-1.5 rounded-3xl sm:rounded-full border border-white/10"
            >
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={DEMO_GOAL}
                aria-label="Mission goal"
                className="flex-1 min-w-0 bg-transparent px-5 py-3 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                type="submit"
                className="btn-orange px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 whitespace-nowrap"
              >
                Launch
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
