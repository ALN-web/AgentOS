import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, ShieldAlert, X } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { timeAgo } from './ui';

const RISK = {
  low: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  medium: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  high: 'text-red-300 border-red-400/30 bg-red-400/10',
};

const RESOLVED = {
  approved: { label: 'Approved', cls: 'text-emerald-300' },
  edited: { label: 'Approved with edits', cls: 'text-emerald-300' },
  rejected: { label: 'Rejected', cls: 'text-red-300' },
};

export default function ApprovalCard({ approval, showMission = false }) {
  const { decide } = useMissions();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(approval.payload.subject);
  const [body, setBody] = useState(approval.payload.body);
  const pending = approval.status === 'pending';
  const resolved = RESOLVED[approval.status];

  const act = (decision) => decide(approval.missionId, approval.id, decision, decision === 'edit' ? { subject, body } : undefined);

  return (
    <div
      className={`rounded-2xl border p-5 ${
        pending ? 'border-amber-400/40 bg-[#15120a]/80 shadow-[0_0_30px_rgba(251,191,36,0.08)]' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{approval.title}</div>
            {showMission ? (
              <Link to={`/app/missions/${approval.missionId}`} className="text-[11px] text-gray-500 hover:text-[#eb6920] truncate block">
                {approval.goal}
              </Link>
            ) : (
              <div className="text-[11px] text-gray-500">{approval.reason}</div>
            )}
          </div>
        </div>
        {pending ? (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border shrink-0 ${RISK[approval.risk]}`}>
            {approval.risk} risk
          </span>
        ) : (
          <span className={`text-xs font-semibold shrink-0 ${resolved.cls}`}>{resolved.label}</span>
        )}
      </div>

      <div className="rounded-xl bg-black/50 border border-white/5 p-3 text-xs space-y-1.5">
        <div className="flex gap-2">
          <span className="text-gray-500 w-14 shrink-0">From</span>
          <span className="text-gray-300 truncate">{approval.payload.from}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-14 shrink-0">To</span>
          <span className="text-gray-300 truncate">{approval.payload.to}</span>
        </div>
        <div className="flex gap-2 items-start">
          <span className="text-gray-500 w-14 shrink-0 pt-0.5">Subject</span>
          {editing ? (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 bg-black/60 border border-white/10 rounded-md px-2 py-1 text-white focus:outline-none focus:border-[#eb6920]/60"
            />
          ) : (
            <span className="text-white font-medium">{approval.payload.subject}</span>
          )}
        </div>
        <div className="pt-2 border-t border-white/5">
          {editing ? (
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-md px-2 py-1.5 text-gray-200 focus:outline-none focus:border-[#eb6920]/60 resize-none"
            />
          ) : (
            <p className="text-gray-400 whitespace-pre-line leading-relaxed line-clamp-6">{approval.payload.body}</p>
          )}
        </div>
      </div>

      {pending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button onClick={() => act('edit')} className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Approve with edits
              </button>
              <button onClick={() => setEditing(false)} className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => act('approve')} className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button onClick={() => setEditing(true)} className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => act('reject')}
                className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-red-300 border border-red-400/20 hover:bg-red-400/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Reject
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-gray-600">Decided {timeAgo(approval.resolvedAt)}</div>
      )}
    </div>
  );
}
