import { useEffect, useState, useCallback, useMemo } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';
import { APPS_CATALOGUE, getConnectedServicesStatus } from '../data/apps';

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

export function reconcileAppsWithIntegrations(appsList = [], integrationsList = []) {
  if (!Array.isArray(appsList) || appsList.length === 0) return appsList;
  const googleInteg = Array.isArray(integrationsList)
    ? integrationsList.find((i) => i.provider === 'google')
    : null;

  if (!googleInteg) return appsList;

  const integScopes = new Set(
    (googleInteg.scopes || []).map((s) => s.split('/').pop())
  );
  const isGoogleConnected = googleInteg.status === 'connected';
  const isGoogleNeedsReconnect = googleInteg.status === 'needs_reconnect';

  const GOOGLE_APP_SCOPES = {
    'google-calendar': ['calendar.events'],
    'gmail': ['gmail.send', 'gmail.compose'],
    'google-drive': ['drive.file'],
    'google-forms': ['forms.body'],
  };

  return appsList.map((app) => {
    const requiredScopes = GOOGLE_APP_SCOPES[app.id];
    if (!requiredScopes) return app;

    const hasScope = requiredScopes.some((sc) => integScopes.has(sc));
    let nextStatus = app.status;

    if (app.status === 'connected') {
      nextStatus = 'connected';
    } else if (app.status === 'needs_reconnect') {
      nextStatus = 'needs_reconnect';
    } else if (isGoogleNeedsReconnect && (integScopes.size === 0 || hasScope)) {
      nextStatus = 'needs_reconnect';
    } else if (isGoogleConnected && hasScope) {
      nextStatus = 'connected';
    }

    const isConnectedOrReconnect = nextStatus === 'connected' || nextStatus === 'needs_reconnect';

    return {
      ...app,
      status: nextStatus,
      accountEmail: isConnectedOrReconnect
        ? (app.accountEmail || googleInteg.account_email)
        : app.accountEmail,
      grantedScopes: isConnectedOrReconnect
        ? (app.grantedScopes && app.grantedScopes.length > 0 ? app.grantedScopes : (googleInteg.scopes || []))
        : app.grantedScopes,
    };
  });
}

export function useConnectedApps() {
  const [apps, setApps] = useState(getStoredLocalApps);
  const [integrations, setIntegrations] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(Boolean(LIVE_API_URL));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!LIVE_API_URL) return;
    try {
      const h = await api.health();
      if (h?.live_mode?.available) {
        setIsLive(true);
        const [liveApps, liveIntegrations] = await Promise.all([
          api.listApps().catch(() => []),
          api.listIntegrations().catch(() => []),
        ]);
        const finalApps = Array.isArray(liveApps) && liveApps.length > 0
          ? reconcileAppsWithIntegrations(liveApps, liveIntegrations)
          : [];
        if (finalApps.length > 0) {
          setApps(finalApps);
        }
        if (Array.isArray(liveIntegrations)) {
          setIntegrations(liveIntegrations);
        }
      }
    } catch (err) {
      setError(err.message || 'Backend not responding');
    } finally {
      setLoading(false);
    }
  }, []);

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
          return Promise.all([
            api.listApps().catch(() => []),
            api.listIntegrations().catch(() => []),
          ]).then(([liveApps, liveIntegrations]) => {
            if (!active) return;
            const finalApps = Array.isArray(liveApps) && liveApps.length > 0
              ? reconcileAppsWithIntegrations(liveApps, liveIntegrations)
              : [];
            if (finalApps.length > 0) {
              setApps(finalApps);
            }
            if (Array.isArray(liveIntegrations)) {
              setIntegrations(liveIntegrations);
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
      if (isLive) {
        try {
          const res = await api.disconnectApp(appId);
          const affected = res?.affected_apps && res.affected_apps.length > 0 ? res.affected_apps : [appId];
          setApps((prevApps) => {
            const next = prevApps.map((app) => {
              if (affected.includes(app.id)) {
                return {
                  ...app,
                  status: 'available',
                  accountEmail: null,
                  grantedScopes: [],
                };
              }
              return app;
            });
            saveLocalApps(next);
            return next;
          });
          return res;
        } catch (err) {
          setError(err.message || 'Failed to disconnect app on server');
          setApps(getStoredLocalApps);
          throw err;
        }
      } else {
        setApps((prevApps) => {
          const next = prevApps.map((app) => {
            if (app.id !== appId) return app;
            return {
              ...app,
              status: 'available',
              accountEmail: null,
              grantedScopes: [],
            };
          });
          saveLocalApps(next);
          return next;
        });
      }
    },
    [isLive]
  );

  // Connect an app (in Live Mode: triggers OAuth for Google apps; in Demo Mode: catalogue stays honest)
  const connect = useCallback(
    async (appId) => {
      const targetAppId = appId === 'drive' ? 'google-drive' : appId === 'forms' ? 'google-forms' : appId;
      if (isLive && (targetAppId.startsWith('google-') || targetAppId === 'gmail')) {
        try {
          const res = await api.connectGoogle([targetAppId]);
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

  const servicesStatus = useMemo(
    () => getConnectedServicesStatus(integrations, apps),
    [integrations, apps]
  );

  return {
    apps,
    integrations,
    servicesStatus,
    isLive,
    loading,
    error,
    updatePermission,
    disconnect,
    connect,
    refresh,
  };
}
