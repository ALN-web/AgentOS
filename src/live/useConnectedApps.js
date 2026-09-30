import { useEffect, useState, useCallback } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';
import { APPS_CATALOGUE } from '../data/apps';

const LOCAL_STORAGE_KEY = 'agentos_apps_permissions';

function getStoredLocalApps() {
  if (typeof window === 'undefined') return APPS_CATALOGUE;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return APPS_CATALOGUE;
    const stored = JSON.parse(raw);
    return APPS_CATALOGUE.map((app) => {
      const saved = stored[app.id];
      if (!saved) return app;
      return {
        ...app,
        actions: app.actions.map((act) => ({
          ...act,
          mode: saved.actions?.[act.id] !== undefined ? saved.actions[act.id] : act.mode,
        })),
      };
    });
  } catch {
    return APPS_CATALOGUE;
  }
}

function saveLocalApps(apps) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = {};
    for (const app of apps) {
      serialized[app.id] = {
        actions: Object.fromEntries(app.actions.map((a) => [a.id, a.mode])),
      };
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage quota errors
  }
}

export function useConnectedApps() {
  const [apps, setApps] = useState(getStoredLocalApps);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(Boolean(LIVE_API_URL));
  const [error, setError] = useState(null);

  // Sync with live backend if LIVE_API_URL is configured
  useEffect(() => {
    if (!LIVE_API_URL) {
      setLoading(false);
      return;
    }

    let active = true;
    api
      .health()
      .then((h) => {
        if (!active) return;
        if (h?.live_mode?.available) {
          setIsLive(true);
          return api.listApps().then((liveApps) => {
            if (!active) return;
            if (Array.isArray(liveApps) && liveApps.length > 0) {
              setApps(liveApps);
            }
          });
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Backend not responding');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Update permission for a single action in an app
  const updatePermission = useCallback(
    async (appId, actionId, newMode) => {
      // Optimistic update
      setApps((prevApps) => {
        const next = prevApps.map((app) => {
          if (app.id !== appId) return app;
          return {
            ...app,
            actions: app.actions.map((act) => {
              if (act.id !== actionId) return act;
              return { ...act, mode: newMode };
            }),
          };
        });
        saveLocalApps(next);
        return next;
      });

      if (isLive) {
        try {
          await api.updateAppPermissions(appId, { [actionId]: newMode });
        } catch (err) {
          setError(err.message || 'Failed to update permission on server');
          // Revert on error
          setApps(getStoredLocalApps);
          throw err;
        }
      }
    },
    [isLive]
  );

  // Disconnect an app
  const disconnect = useCallback(
    async (appId) => {
      setApps((prevApps) => {
        const next = prevApps.map((app) => {
          if (app.id !== appId) return app;
          return {
            ...app,
            status: 'available',
            accountEmail: null,
          };
        });
        saveLocalApps(next);
        return next;
      });

      if (isLive) {
        try {
          if (appId.startsWith('google-') || appId === 'gmail') {
            await api.disconnectGoogle().catch(() => {});
          }
          await api.disconnectApp(appId).catch(() => {});
        } catch (err) {
          setError(err.message || 'Failed to disconnect app on server');
          setApps(getStoredLocalApps);
          throw err;
        }
      }
    },
    [isLive]
  );

  // Connect an app (in Live Mode: triggers OAuth for Google apps; in Demo Mode: catalogue stays honest)
  const connect = useCallback(
    async (appId) => {
      if (isLive && (appId.startsWith('google-') || appId === 'gmail')) {
        try {
          const res = await api.connectGoogle();
          if (res?.authorization_url) {
            window.location.href = res.authorization_url;
            return;
          }
        } catch (err) {
          setError(err.message || 'Failed to connect Google');
          throw err;
        }
      }
    },
    [isLive]
  );

  return {
    apps,
    isLive,
    loading,
    error,
    updatePermission,
    disconnect,
    connect,
  };
}
