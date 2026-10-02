import React from 'react';
import { Server, Loader2 } from 'lucide-react';
import { useBackendStatus, COLD_START_MESSAGE } from './useBackendStatus';

// Shown only when a backend is configured. It reports the connection, not a
// Live Mode switch: Live Mode stays hidden until the backend says it is available.
export default function BackendStatus({ statusOverride = null }) {
  const backendStatus = useBackendStatus();
  const s = statusOverride || backendStatus;
  if (!s.configured) return null;

  const isConnected = s.status === 'connected';

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed" role="status">
      <div className="flex items-center gap-1.5 font-semibold text-gray-300 mb-0.5">
        <Server className="w-3 h-3 text-[#eb6920]" />
        AgentOS backend
        <span className="ml-auto inline-flex items-center gap-1 font-normal text-gray-400">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          {isConnected ? 'Connected' : 'Connecting…'}
        </span>
      </div>
      {isConnected ? (
        <div>
          v{s.version} · database {s.database}
          <br />
          {s.liveMode?.available ? 'Live Mode available' : 'Live Mode not available yet'}
        </div>
      ) : (
        <div className="text-amber-400/90 flex items-center gap-1.5 mt-1">
          <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[#eb6920]" />
          <span>{s.message || COLD_START_MESSAGE}</span>
        </div>
      )}
    </div>
  );
}
