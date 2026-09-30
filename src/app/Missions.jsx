import React, { useState } from 'react';
import { Plus, Rocket, Settings, X } from 'lucide-react';
import { useMissions } from '../store/MissionStore';
import { usePreferences } from '../store/PreferencesStore';
import MissionRow, { MissionHeader } from '../components/MissionRow';
import { EmptyState, STATUS_META } from '../components/ui';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../live/api';
import { useBackendStatus } from '../live/useBackendStatus';

const FILTERS = ['all', ...Object.keys(STATUS_META)];

export default function Missions() {
  const { missions, openLauncher } = useMissions();
  const { preferences, updatePreferences } = usePreferences();
  const [filter, setFilter] = useState('all');
  const now = Date.now();
  const count = (f) => (f === 'all' ? missions.length : missions.filter((m) => m.status === f).length);
  const shown = filter === 'all' ? missions : missions.filter((m) => m.status === filter);
  
  const showNudge = !preferences.dismissedNudge && !preferences.displayName && preferences.groups.length === 0 && !preferences.signature;

  const navigate = useNavigate();
  const backendStatus = useBackendStatus();
  const isLiveAvailable = Boolean(backendStatus?.liveMode?.available);
  const [liveMissions, setLiveMissions] = useState([]);
  const [liveLoading, setLiveLoading] = useState(isLiveAvailable);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLiveAvailable) {
      setLiveLoading(false);
      return;
    }
    let active = true;
    api.listMissions()
      .then(res => {
        if (active) {
          setLiveMissions(Array.isArray(res) ? res : []);
          setLiveLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setLiveError(err.message || 'Failed to load Live missions');
          setLiveLoading(false);
        }
      });
    return () => { active = false; };
  }, [isLiveAvailable]);

  const liveShown = filter === 'all' ? liveMissions : liveMissions.filter((m) => m.status === filter);
  const getCount = (f) => {
    const demoC = (f === 'all' ? missions.length : missions.filter((m) => m.status === f).length);
    const liveC = (f === 'all' ? liveMissions.length : liveMissions.filter((m) => m.status === f).length);
    return demoC + liveC;
  };

  return (
    <div>
      {showNudge && (
        <div className="mb-6 relative overflow-hidden rounded-2xl border border-[#eb6920]/30 bg-[#eb6920]/10 p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <button 
            onClick={() => updatePreferences({ dismissedNudge: true })}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Tell AgentOS about you</h2>
            <p className="text-sm text-gray-300 max-w-xl">
              Set your timezone, working hours, signature and team once. AgentOS will use them when planning your missions.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => updatePreferences({ dismissedNudge: true })} className="text-xs font-semibold text-gray-400 hover:text-white transition-colors">
              Not now
            </button>
            <Link to="/app/settings" className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Set preferences
            </Link>
          </div>
        </div>
      )}

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
            <span className="ml-1.5 tabular-nums text-gray-500">{getCount(f)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Live Missions
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            {!isLiveAvailable ? (
              <div className="p-8 text-center text-sm text-gray-500">Live Mode is unavailable. AgentOS backend cannot be reached or is not configured.</div>
            ) : liveLoading ? (
              <div className="p-8 text-center text-sm text-gray-500">Loading Live missions...</div>
            ) : liveError ? (
              <div className="p-8 text-center text-sm text-red-400">{liveError}</div>
            ) : liveShown.length > 0 ? (
              <>
                <MissionHeader />
                {liveShown.map((m) => (
                  <div key={m.id}>
                    <MissionRow m={{...m, isLive: true, createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now()}} now={now} />
                  </div>
                ))}
              </>
            ) : (
              <div className="p-8 text-center text-sm text-gray-500">No Live missions yet.</div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            Demo Missions
          </h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            {shown.length > 0 && <MissionHeader />}
            {shown.map((m) => (
              <div key={m.id}>
                <MissionRow m={m} now={now} />
              </div>
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
      </div>
    </div>
  );
}
