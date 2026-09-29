import React from 'react';
import { Server } from 'lucide-react';
import { useBackendStatus } from './useBackendStatus';

const DOT = { connected: 'bg-emerald-400', checking: 'bg-amber-400 animate-pulse', unreachable: 'bg-red-400' };
const LABEL = { connected: 'Connected', checking: 'Checking…', unreachable: 'Unreachable' };

// Shown only when a backend is configured. It reports the connection, not a
// Live Mode switch: Live Mode stays hidden until the backend says it is available.
export default function BackendStatus() {
  const s = useBackendStatus();
  if (!s.configured) return null;

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed" role="status">
      <div className="flex items-center gap-1.5 font-semibold text-gray-300 mb-0.5">
        <Server className="w-3 h-3 text-[#eb6920]" />
        AgentOS backend
        <span className="ml-auto inline-flex items-center gap-1 font-normal text-gray-400">
          <span className={`w-1.5 h-1.5 rounded-full ${DOT[s.status]}`} />
          {LABEL[s.status]}
        </span>
      </div>
      {s.status === 'connected' && (
        <div>
          v{s.version} · database {s.database}
          <br />
          {s.liveMode?.available ? 'Live Mode available' : 'Live Mode not available yet'}
        </div>
      )}
      {s.status === 'unreachable' && <div>{s.error}</div>}
    </div>
  );
}
