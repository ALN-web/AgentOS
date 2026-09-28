import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function TemplateCard({ template, onSelect, height = 'h-[380px]' }) {
  return (
    <button
      onClick={() => onSelect(template)}
      className={`group relative ${height} w-full text-left rounded-3xl overflow-hidden border border-white/10 hover:border-[#eb6920]/40 transition-all duration-300 bg-[#0d0b13] flex flex-col justify-between`}
    >
      <div className="absolute inset-0">
        <img
          src={template.image}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-75 group-hover:brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="relative p-5 flex justify-between items-start">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
          {template.category}
        </span>
        <span className="w-10 h-10 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white group-hover:bg-[#eb6920] group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(235,105,32,0.6)] transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>

      <div className="relative p-4">
        <div className="p-5 rounded-2xl bg-black/75 backdrop-blur-xl border border-white/10 group-hover:border-[#eb6920]/30 transition-colors">
          <h3 className="text-lg font-bold text-white mb-1">{template.name}</h3>
          <p className="text-sm text-gray-300 mb-3">{template.tagline}</p>
          <p className="text-xs text-gray-500 pt-3 border-t border-white/10">
            Try: <span className="text-gray-300">“{template.goal}”</span>
          </p>
        </div>
      </div>
    </button>
  );
}
