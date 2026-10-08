import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, CheckCircle2, Circle, ChevronDown, ListChecks, ShieldAlert, XCircle, AlertTriangle, RotateCcw, Clock, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import { AgentIcon, agentName, formatDuration } from '../../components/ui';
import { taskCounts, taskDuration } from '../../engine/selectors';

const STATUS_ICONS = {
  done: { icon: CheckCircle2, cls: 'text-emerald-400' },
  failed: { icon: XCircle, cls: 'text-red-400' },
  awaiting: { icon: ShieldAlert, cls: 'text-amber-300' },
  running: { icon: Loader2, cls: 'text-[#eb6920] animate-spin' },
  pending: { icon: Clock, cls: 'text-gray-500' },
  skipped: { icon: Clock, cls: 'text-gray-600' }
};

export default function ProofPanel({ m }) {
  const [expandedTask, setExpandedTask] = useState(null);

  if (!m) return null;

  const { total, done } = taskCounts(m);
  const failedTasks = m.tasks.filter(t => t.status === 'failed').length;
  const recoveries = m.recoveries;
  const checks = m.checks || [];
  const criteria = m.plan?.criteria || [];
  const pendingApprovals = m.approvals.filter(a => a.status === 'pending');
  const decidedApprovals = m.approvals.filter(a => a.status !== 'pending');

  const isVerified = m.status === 'completed' && checks.length > 0 && checks.every(c => c.status === 'done');
  
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-6" aria-label="Proof and Verification Panel">
      {/* MISSION SUMMARY */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
          {isVerified ? (
            <span className="text-emerald-400 flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5" /> Mission Verified</span>
          ) : (
            <span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" /> Mission Status</span>
          )}
        </div>
        <h3 className="text-sm font-bold text-white leading-snug mb-3">{m.goal}</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-black/40 rounded-lg p-2 border border-white/5">
            <div className="text-gray-500 mb-0.5">Tasks</div>
            <div className="font-semibold text-white">{done} / {total} done</div>
          </div>
          {(failedTasks > 0 || recoveries.length > 0) && (
            <div className="bg-black/40 rounded-lg p-2 border border-white/5">
              <div className="text-gray-500 mb-0.5">Issues</div>
              <div className="font-semibold text-white">
                {failedTasks > 0 ? <span className="text-red-400">{failedTasks} failed</span> : null}
                {failedTasks > 0 && recoveries.length > 0 ? ' · ' : null}
                {recoveries.length > 0 ? <span className="text-[#ff9a5c]">{recoveries.length} recovered</span> : null}
              </div>
            </div>
          )}
          {m.approvals.length > 0 && (
            <div className="bg-black/40 rounded-lg p-2 border border-white/5">
              <div className="text-gray-500 mb-0.5">Approvals</div>
              <div className="font-semibold text-white">
                {pendingApprovals.length > 0 ? <span className="text-amber-300">{pendingApprovals.length} pending</span> : <span>{decidedApprovals.length} decided</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS CRITERIA */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Verification</div>
        {checks.length === 0 ? (
          criteria.length > 0 ? (
            <ul className="space-y-2">
              {criteria.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-xs text-gray-400">
                  <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-600" />
                  {c.label}
                </li>
              ))}
              {pendingApprovals.length > 0 && (
                <li className="flex items-start gap-2 text-xs text-amber-300">
                  <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Pending approval
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-gray-600">Runs once the work is done. Nothing counts until it’s checked.</p>
          )
        ) : (
          <ul className="space-y-2">
            {checks.map((c, i) => {
              const Icon = STATUS_ICONS[c.status]?.icon || CheckCircle2;
              const cls = STATUS_ICONS[c.status]?.cls || 'text-emerald-400';
              return (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cls}`} />
                  {c.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Removed TASK RESULTS, it has been moved to TaskResults.jsx in the main column */}
    </div>
  );
}
