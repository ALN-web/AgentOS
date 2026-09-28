import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import ApprovalCard from '../components/ApprovalCard';

export default function Approvals() {
  const { missions } = useMissions();
  const all = missions.flatMap((m) => m.approvals);
  const pending = all.filter((a) => a.status === 'pending').sort((a, b) => b.requestedAt - a.requestedAt);
  const history = all.filter((a) => a.status !== 'pending').sort((a, b) => b.resolvedAt - a.resolvedAt);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Approvals</h1>
        <p className="text-sm text-gray-400 mt-1">
          Agents pause here before anything risky. Approve, edit or reject, and the mission picks up where it left off.
        </p>
      </div>

      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Waiting on you · {pending.length}</h2>
      {pending.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center mb-10">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">You’re all caught up.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} showMission />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">History</h2>
          <div className="space-y-3">
            {history.map((a) => (
              <ApprovalCard key={a.id} approval={a} showMission />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
