import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Loader2, LogOut, ShieldCheck, Unplug, X, AlertCircle } from 'lucide-react';
import { useGoogleIntegration } from './useGoogleIntegration';
import { useAuth } from './auth';

export default function GoogleConnectControl({ className = '', compact = false }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const {
    connected,
    accountEmail,
    loading,
    connecting,
    notification,
    connect,
    disconnect,
    dismissNotification,
  } = useGoogleIntegration();

  const handleConnect = () => {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    connect();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {notification && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            notification.type === 'error'
              ? 'bg-red-500/10 border-red-500/25 text-red-200'
              : notification.type === 'info'
              ? 'bg-blue-500/10 border-blue-500/25 text-blue-200'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={dismissNotification}
            className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
          connected
            ? 'bg-emerald-500/[0.04] border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.06)]'
            : 'bg-white/[0.02] border-white/10'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.05] border-white/10 text-gray-300'
            }`}
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white tracking-wide">Google Workspace</span>
              {connected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Not connected</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {connected
                ? `Authorized for Calendar & Gmail actions as ${accountEmail}.`
                : 'Connect to allow missions to create Google Calendar events and send Gmail drafts.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {connected ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-400 bg-white/[0.04] hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || loading}
              className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{connecting ? 'Connecting...' : 'Connect Google'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
