import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { EXAMPLE_GOALS } from '../data/templates';

export default function NewMissionModal() {
  const { launcher, launch, closeLauncher } = useMissions();
  const [goal, setGoal] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (launcher.open) {
      setGoal(launcher.goal);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [launcher.open, launcher.goal]);

  useEffect(() => {
    if (!launcher.open) return;
    const onKey = (e) => e.key === 'Escape' && closeLauncher();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launcher.open, closeLauncher]);

  const submit = (e) => {
    e?.preventDefault();
    if (!goal.trim()) return;
    const id = launch(goal);
    navigate(`/app/missions/${id}`);
  };

  return (
    <AnimatePresence>
      {launcher.open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && closeLauncher()}
        >
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full max-w-xl bg-[#0e0c15] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#eb6920]/15 rounded-full blur-3xl pointer-events-none" />

            <button
              type="button"
              onClick={closeLauncher}
              aria-label="Close"
              className="absolute top-5 right-5 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#eb6920] uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" />
                New mission
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">What do you want done?</h3>
              <p className="text-sm text-gray-400 mt-1">Describe the outcome. AgentOS plans and runs the rest.</p>

              <textarea
                ref={inputRef}
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) submit(e);
                }}
                placeholder="e.g. Get 100 registrations for our hackathon"
                className="mt-5 w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#eb6920]/60 resize-none"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/5 transition-colors text-left"
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                <span className="text-[11px] text-gray-500 hidden sm:block">Enter to launch · Esc to close</span>
                <button
                  type="submit"
                  disabled={!goal.trim()}
                  className="btn-orange ml-auto px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Launch mission
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
