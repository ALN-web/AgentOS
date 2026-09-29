import React from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';

// One capability. `onSee` runs the feature's "where to see it" action.
export default function FeatureCard({ feature, onSee }) {
  const { icon: Icon, title, tagline, description, points, note, see } = feature;
  return (
    <article className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col h-full group">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-[#eb6920]/10 border border-[#eb6920]/30 flex items-center justify-center text-[#ff9a5c] shrink-0 group-hover:shadow-orange-glow-sm transition-shadow">
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <p className="text-xs text-[#ff9a5c] font-medium">{tagline}</p>
        </div>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed mb-4">{description}</p>
      <ul className="space-y-1.5 mb-4">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-xs text-gray-300">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
            {p}
          </li>
        ))}
      </ul>
      {note && (
        <p className="flex items-start gap-1.5 text-[11px] text-gray-500 mb-4">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          {note}
        </p>
      )}
      <button
        onClick={() => onSee(see)}
        className="mt-auto self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#eb6920] hover:text-[#ff9a5c] transition-colors focus:outline-none focus-visible:underline"
      >
        {see.label}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </article>
  );
}
