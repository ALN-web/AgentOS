import { useEffect, useState } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';

const RECHECK_MS = 30_000;

// { configured: false } in Demo builds (no request is ever made); otherwise the
// backend's health, re-checked every 30 s.
export function useBackendStatus() {
  const [state, setState] = useState(LIVE_API_URL ? { configured: true, status: 'checking' } : { configured: false });

  useEffect(() => {
    if (!LIVE_API_URL) return undefined;
    let alive = true;
    const check = () =>
      api
        .health()
        .then((h) => alive && setState({ configured: true, status: 'connected', version: h.version, database: h.database, liveMode: h.live_mode }))
        .catch((e) => alive && setState({ configured: true, status: 'unreachable', error: e.message }));
    check();
    const id = setInterval(check, RECHECK_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return state;
}
