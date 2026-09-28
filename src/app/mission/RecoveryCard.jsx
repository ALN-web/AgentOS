import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, RotateCcw, Search, Workflow } from 'lucide-react';

const ORDER = ['diagnosing', 'replanning', 'retrying', 'resolved'];

export default function RecoveryCard({ recovery }) {
  const stage = ORDER.indexOf(recovery.status);
  const resolved = recovery.status === 'resolved';

  const steps = [
    { icon: AlertTriangle, label: 'Failure detected', text: recovery.error, reached: true },
    { icon: Search, label: 'Root cause', text: recovery.diagnosis, reached: stage >= 1 },
    { icon: Workflow, label: 'New plan', text: recovery.plan, reached: stage >= 2 },
    { icon: Check, label: resolved ? 'Recovered' : 'Retrying…', text: resolved ? 'Mission back on track.' : null, reached: stage >= 2 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl border p-5 relative overflow-hidden ${
        resolved ? 'border-[#eb6920]/30 bg-[#140f0b]' : 'border-red-500/40 bg-[#160c0c] shadow-[0_0_40px_rgba(239,68,68,0.12)]'
      }`}
    >
      {!resolved && <div className="absolute -top-16 -right-16 w-40 h-40 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <RotateCcw className={`w-4 h-4 ${resolved ? 'text-[#eb6920]' : 'text-red-400 animate-spin [animation-duration:2s]'}`} />
          Recovery
        </div>
        <span className="text-[11px] text-gray-500 truncate ml-3">{recovery.task}</span>
      </div>

      <ol className="relative space-y-3">
        {steps.map(({ icon: Icon, label, text, reached }, i) => (
          <li key={label} className={`flex gap-3 transition-opacity duration-500 ${reached ? 'opacity-100' : 'opacity-30'}`}>
            <span
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                i === 0
                  ? 'text-red-300 border-red-400/30 bg-red-400/10'
                  : i === 3 && resolved
                  ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10'
                  : 'text-[#ff9a5c] border-[#eb6920]/30 bg-[#eb6920]/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-gray-200">{label}</div>
              {text && reached && <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}
