import { useEffect, useState, useCallback } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';

export function useGoogleIntegration() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('not_connected'); // 'connected' | 'needs_reconnect' | 'not_connected'
  const [accountEmail, setAccountEmail] = useState(null);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(Boolean(LIVE_API_URL));
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const refresh = useCallback(async () => {
    if (!LIVE_API_URL) return;
    try {
      const h = await api.health();
      if (!h?.live_mode?.available) {
        setConnected(false);
        setStatus('not_connected');
        return;
      }
      const integs = await api.listIntegrations();
      const g = Array.isArray(integs) ? integs.find((i) => i.provider === 'google') : null;
      if (g && g.status === 'connected') {
        setConnected(true);
        setStatus('connected');
        setAccountEmail(g.account_email || null);
        setScopes(g.scopes || []);
      } else if (g && g.status === 'needs_reconnect') {
        setConnected(false);
        setStatus('needs_reconnect');
        setAccountEmail(g.account_email || null);
        setScopes(g.scopes || []);
      } else {
        setConnected(false);
        setStatus('not_connected');
        setAccountEmail(null);
        setScopes([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to check Google connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check URL parameters for OAuth callbacks
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected') === 'google') {
        setNotification({
          type: 'success',
          message: 'Google connected successfully',
        });
        params.delete('connected');
        const nextUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, document.title, nextUrl);
      } else if (params.get('error')) {
        const errParam = params.get('error');
        setNotification({
          type: 'error',
          message: `Google connection failed: ${errParam}`,
        });
        params.delete('error');
        const nextUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, document.title, nextUrl);
      }
    }

    refresh();
  }, [refresh]);

  const connect = useCallback(async (apps = null) => {
    setConnecting(true);
    setError(null);
    try {
      const res = await api.connectGoogle(apps);
      if (res?.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err.message || 'Failed to start Google connection.');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to initiate Google authorization.',
      });
      setConnecting(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await api.disconnectGoogle();
      setConnected(false);
      setStatus('not_connected');
      setAccountEmail(null);
      setScopes([]);
      setNotification({
        type: 'info',
        message: 'Google Workspace disconnected.',
      });
      await refresh();
    } catch (err) {
      setError(err.message || 'Failed to disconnect Google.');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to disconnect Google.',
      });
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return {
    connected,
    status,
    needsReconnect: status === 'needs_reconnect',
    scopes,
    accountEmail,
    loading,
    connecting,
    error,
    notification,
    connect,
    disconnect,
    refresh,
    dismissNotification: () => setNotification(null),
  };
}
