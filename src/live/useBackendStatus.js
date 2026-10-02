import { useEffect, useState } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';

const CONNECTED_RECHECK_MS = 30_000;
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 10_000;

export const COLD_START_MESSAGE = 'Connecting to the live server… (first visit can take up to a minute)';

// { configured: false } in Demo builds (no request is ever made); otherwise the
// backend's health is queried. If slow or failing during cold start (free hosting can take up to ~60 s to wake),
// it retries automatically and displays a friendly cold-start message without exposing raw errors.
export function useBackendStatus(apiClient = api) {
  const [state, setState] = useState(
    LIVE_API_URL
      ? {
          configured: true,
          status: 'checking',
          message: COLD_START_MESSAGE,
        }
      : { configured: false }
  );

  useEffect(() => {
    if (!LIVE_API_URL) return undefined;
    let alive = true;
    let timerId = null;
    let retryDelay = RETRY_MIN_MS;

    const scheduleNext = (delay) => {
      if (!alive) return;
      clearTimeout(timerId);
      timerId = setTimeout(check, delay);
    };

    const check = async () => {
      if (!alive) return;
      try {
        const h = await apiClient.health();
        if (!alive) return;
        retryDelay = RETRY_MIN_MS;
        setState({
          configured: true,
          status: 'connected',
          version: h.version,
          database: h.database,
          liveMode: h.live_mode,
          message: null,
        });
        scheduleNext(CONNECTED_RECHECK_MS);
      } catch (err) {
        if (!alive) return;
        // While failing or slow during cold start, keep status as checking with friendly cold-start message
        setState((prev) => ({
          ...prev,
          configured: true,
          status: 'checking',
          message: COLD_START_MESSAGE,
          isColdStarting: true,
        }));
        // Fast automatic retry with exponential backoff up to RETRY_MAX_MS
        const currentDelay = retryDelay;
        retryDelay = Math.min(retryDelay * 1.5, RETRY_MAX_MS);
        scheduleNext(currentDelay);
      }
    };

    check();

    return () => {
      alive = false;
      clearTimeout(timerId);
    };
  }, [apiClient]);

  return state;
}
