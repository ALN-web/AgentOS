import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AgentIcon, agentName, formatClock } from '../../components/ui';
import { AGENT_BY_ID } from '../../data/agents';

const TYPE_STYLE = {
  failure: 'border-red-500/30 bg-red-500/[0.06]',
  recovery: 'border-[#eb6920]/30 bg-[#eb6920]/[0.05]',
  recovered: 'border-[#eb6920]/50 bg-[#eb6920]/[0.1]',
  approval: 'border-amber-400/25 bg-amber-400/[0.05]',
  verified: 'border-emerald-500/30 bg-emerald-500/[0.06]',
  complete: 'border-emerald-500/40 bg-emerald-500/[0.1]',
};

const TYPE_TAG = {
  plan: 'Plan',
  action: 'Action',
  critique: 'Review',
  failure: 'Failure',
  recovery: 'Recovery',
  recovered: 'Recovered',
  approval: 'Approval',
  verified: 'Verified',
  complete: 'Complete',
};

export default function ActivityFeed({ events }) {
  const scroller = useRef(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [events.length]);

  return (
    <div ref={scroller} className="h-full overflow-y-auto pr-1 space-y-2">
      {events.map((e) => {
        const color = AGENT_BY_ID[e.agent]?.color || '#9ca3af';
        return (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex gap-3 p-3 rounded-xl border ${TYPE_STYLE[e.type] || 'border-white/5 bg-white/[0.02]'}`}
          >
            <AgentIcon id={e.agent} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold" style={{ color }}>
                  {agentName(e.agent)}
                </span>
                {TYPE_TAG[e.type] && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{TYPE_TAG[e.type]}</span>
                )}
                <span className="ml-auto text-[10px] font-mono text-gray-600">{formatClock(e.t)}</span>
              </div>
              <p className="text-[13px] text-gray-200 leading-relaxed">{e.text}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
