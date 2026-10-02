import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Loader2,
  LogOut,
  ShieldCheck,
  Unplug,
  X,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Plug,
  Calendar,
  Mail,
  HardDrive,
  FileText,
} from 'lucide-react';
import { useGoogleIntegration } from './useGoogleIntegration';
import { useAuth } from './auth';
import { getConnectedServicesStatus, formatScope } from '../data/apps';

function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

const GOOGLE_APPS_LIST = [
  { name: 'Google', icon: GoogleIcon },
  { name: 'Gmail', icon: Mail },
  { name: 'Calendar', icon: Calendar },
  { name: 'Drive', icon: HardDrive },
  { name: 'Forms', icon: FileText },
];

function ServiceStatusBadge({ status }) {
  if (status === 'Connected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Connected
      </span>
    );
  }
  if (status === 'Reconnect') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
        Reconnect
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-400 bg-white/[0.04] border border-white/10">
      Not connected
    </span>
  );
}

export default function GoogleConnectControl({ className = '', compact = false, apps: propApps, integrations: propIntegrations }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const googleIntegration = useGoogleIntegration();
  const {
    connected,
    status,
    needsReconnect,
    scopes,
    accountEmail,
    loading,
    connecting,
    notification,
    connect,
    disconnect,
    dismissNotification,
  } = googleIntegration;

  const effectiveApps = propApps || googleIntegration.apps || [];
  const effectiveIntegrations = propIntegrations || googleIntegration.integrations || [];
  const servicesStatus = useMemo(() => {
    return getConnectedServicesStatus(effectiveIntegrations, effectiveApps);
  }, [effectiveIntegrations, effectiveApps]);

  const serviceItems = [
    { id: 'google', name: 'Google', icon: GoogleIcon, status: servicesStatus.google, appId: null },
    { id: 'gmail', name: 'Gmail', icon: Mail, status: servicesStatus.gmail, appId: 'gmail' },
    { id: 'calendar', name: 'Calendar', icon: Calendar, status: servicesStatus.calendar, appId: 'google-calendar' },
    { id: 'drive', name: 'Drive', icon: HardDrive, status: servicesStatus.drive, appId: 'google-drive' },
    { id: 'forms', name: 'Forms', icon: FileText, status: servicesStatus.forms, appId: 'google-forms' },
  ];

  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  const handleConnect = () => {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    connect();
  };

  const handleConfirmDisconnect = async () => {
    setConfirmDisconnectOpen(false);
    await disconnect();
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
        className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all ${
          connected
            ? 'bg-emerald-500/[0.04] border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.06)]'
            : needsReconnect
            ? 'bg-amber-500/[0.05] border-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,0.08)]'
            : 'bg-white/[0.02] border-white/10'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                connected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : needsReconnect
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
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
                {connected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                )}
                {needsReconnect && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Reconnect
                  </span>
                )}
                {!connected && !needsReconnect && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Not connected</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {connected
                  ? `Authorized for Workspace actions as ${accountEmail || 'your Google account'}.`
                  : needsReconnect
                  ? 'Access expired or was revoked. Reconnect to restore automated actions.'
                  : 'Connect to allow missions to create Calendar events, send emails, and access Workspace apps.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {connected ? (
              <button
                type="button"
                onClick={() => setConfirmDisconnectOpen(true)}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-400 bg-white/[0.04] hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                <span>Disconnect</span>
              </button>
            ) : needsReconnect ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDisconnectOpen(true)}
                  disabled={loading}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-400 bg-white/[0.04] hover:bg-red-500/10 border border-white/5 transition-all"
                >
                  Disconnect
                </button>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || loading}
                  className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                  <span>{connecting ? 'Connecting...' : 'Reconnect Google'}</span>
                </button>
              </div>
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

        {/* 5-Service Status Grid: Google, Gmail, Calendar, Drive, Forms */}
        <div className="pt-3 border-t border-white/5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center justify-between">
            <span>Workspace Services Status</span>
            <span className="text-[10px] font-normal text-gray-500">Google · Gmail · Calendar · Drive · Forms</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {serviceItems.map((s) => (
              <div
                key={s.id}
                className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-white/[0.04] text-[#eb6920]">
                    <s.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-white truncate">{s.name}</span>
                </div>
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <ServiceStatusBadge status={s.status} />
                  {s.status === 'Reconnect' && s.appId && (
                    <button
                      type="button"
                      onClick={() => connect([s.appId])}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-0.5"
                      title={`Reconnect ${s.name}`}
                    >
                      <RotateCw className="w-2.5 h-2.5" />
                      <span>Reconnect</span>
                    </button>
                  )}
                  {s.status === 'Not connected' && connected && s.appId && (
                    <button
                      type="button"
                      onClick={() => connect([s.appId])}
                      className="text-[10px] text-[#eb6920] hover:text-[#ff7d36] font-medium hover:underline flex items-center gap-0.5"
                      title={`Connect ${s.name}`}
                    >
                      <Plug className="w-2.5 h-2.5" />
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Granted Scopes Chips (Plain-Language) */}
        {(connected || needsReconnect) && scopes && scopes.length > 0 && (
          <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-gray-500 font-medium">Granted permissions:</span>
            {scopes.map((sc) => (
              <span
                key={sc}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/[0.05] border border-white/10 text-gray-300"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>{formatScope(sc)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal listing all affected apps */}
      {confirmDisconnectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0d0b13] border border-white/10 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-bold text-white mb-2">Disconnect Google Workspace?</h4>

            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Disconnecting Google Workspace revokes your authorization with Google and disconnects all linked Google services:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {GOOGLE_APPS_LIST.map(({ name, icon: Icon }) => (
                <div
                  key={name}
                  className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2 text-xs text-gray-300"
                >
                  <Icon className="w-4 h-4 text-[#eb6920]" />
                  <span>{name}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 mb-6">
              Any scheduled missions or tasks relying on these apps will be paused until reconnected.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDisconnectOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition-colors"
              >
                Keep connected
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect All Google Apps</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
