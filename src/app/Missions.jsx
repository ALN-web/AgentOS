import React, { useState } from 'react';
import { Plus, Rocket } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import MissionRow, { MissionHeader } from '../components/MissionRow';
import { EmptyState, STATUS_META } from '../components/ui';

const FILTERS = ['all', ...Object.keys(STATUS_META)];

export default function Missions() {
  const { missions, openLauncher } = useMissions();
  const [filter, setFilter] = useState('all');
  const now = Date.now();
  const count = (f) => (f === 'all' ? missions.length : missions.filter((m) => m.status === f).length);
  const shown = filter === 'all' ? missions : missions.filter((m) => m.status === filter);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Missions</h1>
          <p className="text-sm text-gray-400 mt-1">Every mission you have launched in this session, newest first.</p>
        </div>
        <button onClick={() => openLauncher()} className="btn-orange self-start sm:self-auto px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New mission
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === f ? 'border-[#eb6920]/40 bg-[#eb6920]/10 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            {f === 'all' ? 'All' : STATUS_META[f].label}
            <span className="ml-1.5 tabular-nums text-gray-500">{count(f)}</span>
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {shown.length > 0 && <MissionHeader />}
        {shown.map((m) => (
          <MissionRow key={m.id} m={m} now={now} />
        ))}
        {shown.length === 0 && (
          <EmptyState
            icon={Rocket}
            title={filter === 'all' ? 'No missions yet' : `No ${STATUS_META[filter].label.toLowerCase()} missions`}
            action={
              <button onClick={() => openLauncher()} className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold">
                Launch a mission
              </button>
            }
          >
            Launch a mission and let AgentOS take it from here.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
