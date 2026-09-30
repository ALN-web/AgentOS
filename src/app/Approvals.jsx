import React from 'react';
import { CheckCircle2, History, Pencil, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import ApprovalCard from '../components/ApprovalCard';
import { EmptyState } from '../components/ui';
import { api } from '../live/api';
import { useAuth } from '../live/auth';

function Count({ icon: Icon, label, value, tone }) {
  return (
    <div className="glass-card rounded-2xl px-4 py-3.5">
      <div className="flex items-center justify-between text-gray-500 mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export default function Approvals() {
  const { missions } = useMissions();
  const { user } = useAuth();
  const [livePending, setLivePending] = useState([]);

  useEffect(() => {
    if (user) {
      api.listApprovals('pending').then(data => {
        const live = data.map(a => ({
          ...a,
          missionId: a.mission_id,
          taskId: a.task_id,
          title: a.reason,
          agent: 'approval',
          isLive: true,
          original: a.original_payload,
          requestedAt: new Date(a.requested_at).getTime()
        }));
        setLivePending(live);
      }).catch(console.error);
    } else {
      setLivePending([]);
    }
  }, [user]);

  const demoApprovals = missions.flatMap((m) => m.approvals);
  const all = [...demoApprovals, ...livePending];
  const pending = all.filter((a) => a.status === 'pending').sort((a, b) => b.requestedAt - a.requestedAt);
  const history = demoApprovals.filter((a) => a.status !== 'pending').sort((a, b) => b.resolvedAt - a.resolvedAt);
  const count = (s) => demoApprovals.filter((a) => a.status === s).length;

  const handleLiveDecide = async (id, decision, edits) => {
    await api.decideApproval(id, decision, edits);
    setLivePending(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Approvals</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-2xl">
          The control layer between AgentOS and the outside world. Before any agent emails people, pays, or submits in your name, the
          mission pauses here. Approve it, edit it, or reject it, and the mission continues from that exact point.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Count icon={ShieldAlert} label="Waiting" value={pending.length} tone="text-amber-300" />
        <Count icon={CheckCircle2} label="Approved" value={count('approved')} tone="text-emerald-300" />
        <Count icon={Pencil} label="Edited" value={count('edited')} tone="text-[#ff9a5c]" />
        <Count icon={XCircle} label="Rejected" value={count('rejected')} tone="text-red-300" />
      </div>

      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Waiting on you · {pending.length}</h2>
      {pending.length === 0 ? (
        <div className="glass-card rounded-2xl mb-10">
          <EmptyState icon={ShieldCheck} title="All clear">
            No actions are waiting for your approval.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} showMission onDecide={a.isLive ? handleLiveDecide : undefined} />
          ))}
        </div>
      )}

      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Decision history · {history.length}</h2>
      {history.length === 0 ? (
        <div className="glass-card rounded-2xl">
          <EmptyState icon={History} title="No decisions yet">
            Every approval you give or refuse is recorded here with what changed.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((a) => (
            <ApprovalCard key={a.id} approval={a} showMission compact />
          ))}
        </div>
      )}
    </div>
  );
}
