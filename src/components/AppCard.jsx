import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  HardDrive,
  FileText,
  MessageSquare,
  PhoneCall,
  BookOpen,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  XCircle,
  Unplug,
  Plug,
  Info,
} from 'lucide-react';
import { RISK_LEVELS, PERMISSION_MODES, formatScope } from '../data/apps';

// Map icon names to Lucide icons
const APP_ICONS = {
  Calendar,
  Mail,
  HardDrive,
  FileText,
  MessageSquare,
  PhoneCall,
  BookOpen,
  Radio,
};

export default function AppCard({ app, onUpdatePermission, onDisconnect, onConnect, isLive, allApps = [] }) {
  const [activeTab, setActiveTab] = useState('permissions'); // 'permissions' | 'activity'
  const [expanded, setExpanded] = useState(true);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectEmail, setConnectEmail] = useState('');

  const IconComponent = APP_ICONS[app.icon] || Plug;

  const isConnected = app.status === 'connected';
  const isNeedsReconnect = app.status === 'needs_reconnect';
  const isAvailable = app.status === 'available';
  const isDemo = app.status === 'demo';
  const isComingSoon = app.status === 'coming_soon';

  const isGoogleApp = app.provider === 'Google' || app.id.startsWith('google-') || app.id === 'gmail';
  const affectedApps = isGoogleApp
    ? (allApps.filter((a) => a.provider === 'Google' || a.id.startsWith('google-') || a.id === 'gmail').length > 0
        ? allApps.filter((a) => a.provider === 'Google' || a.id.startsWith('google-') || a.id === 'gmail')
        : [
            { id: 'google-calendar', name: 'Google Calendar' },
            { id: 'gmail', name: 'Gmail' },
            { id: 'google-drive', name: 'Google Drive' },
            { id: 'google-forms', name: 'Google Forms' },
          ])
    : [app];

  const handleModeChange = (actionId, risk, targetMode) => {
    // Safety check: HIGH and CRITICAL can never be set to 'allowed'
    if ((risk === 'HIGH' || risk === 'CRITICAL') && targetMode === 'allowed') {
      return;
    }
    onUpdatePermission(app.id, actionId, targetMode);
  };

  const handleConfirmDisconnect = () => {
    onDisconnect(app.id);
    setDisconnectModalOpen(false);
  };

  const handleConfirmConnect = (e) => {
    e.preventDefault();
    if (connectEmail.trim()) {
      onConnect(app.id, connectEmail.trim());
      setConnectModalOpen(false);
      setConnectEmail('');
    }
  };

  return (
    <div className={`glass-card rounded-2xl p-5 sm:p-6 relative overflow-hidden transition-all duration-200 border ${
      isConnected
        ? 'border-white/10 hover:border-[#eb6920]/40 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
        : isNeedsReconnect
        ? 'border-amber-500/35 bg-amber-500/[0.02] shadow-[0_0_20px_rgba(245,158,11,0.06)]'
        : isAvailable
        ? 'border-white/10 hover:border-white/20'
        : isDemo
        ? 'border-amber-500/20 bg-amber-500/[0.01]'
        : 'border-white/5 opacity-70 bg-white/[0.01]'
    }`}>
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3.5">
          {/* App Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
            isConnected
              ? 'bg-[#15121c] border-[#eb6920]/40 text-[#eb6920] shadow-[0_0_15px_rgba(235,105,32,0.25)]'
              : isNeedsReconnect
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : isAvailable
              ? 'bg-white/[0.04] border-white/10 text-white'
              : isDemo
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-white/[0.02] border-white/5 text-gray-500'
          }`}>
            <IconComponent className="w-6 h-6" />
          </div>

          {/* App Title & Provider */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-wide">{app.name}</h3>
              <span className="text-[11px] text-gray-500 font-medium">· {app.provider}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">{app.description}</p>
          </div>
        </div>

        {/* Status Badge & Primary Action */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {isConnected && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center gap-1"
                title="Disconnect app"
              >
                <Unplug className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          )}

          {isNeedsReconnect && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Reconnect
              </span>
              <button
                type="button"
                onClick={() => (isLive ? onConnect(app.id) : setConnectModalOpen(true))}
                className="btn-orange px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plug className="w-3 h-3" />
                <span>Reconnect</span>
              </button>
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(true)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Disconnect app"
              >
                <Unplug className="w-3 h-3" />
              </button>
            </div>
          )}

          {(isAvailable || app.status === 'not_connected') && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-gray-400 bg-white/[0.04] border border-white/10">
                Not connected
              </span>
              <button
                type="button"
                onClick={() => (isLive ? onConnect(app.id) : setConnectModalOpen(true))}
                className="btn-orange px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plug className="w-3 h-3" />
                <span>Connect</span>
              </button>
            </div>
          )}

          {isDemo && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Demo
            </span>
          )}

          {isComingSoon && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-gray-500 bg-white/[0.03] border border-white/5 cursor-not-allowed">
              <Lock className="w-3 h-3" />
              Coming soon
            </span>
          )}
        </div>
      </div>

      {/* Connected Account & Scopes Row (Honest status info) */}
      {(isConnected || isNeedsReconnect) && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <span className="text-gray-500 font-medium">Account:</span>
            <span className="font-mono text-white text-[11px] bg-white/[0.05] px-2 py-0.5 rounded border border-white/10">
              {app.accountEmail || 'Connected'}
            </span>
          </div>

          {app.grantedScopes && app.grantedScopes.length > 0 && (
            <div className="flex items-center gap-1.5 text-gray-400 text-[11px] flex-wrap">
              <span className="text-gray-500 font-medium">Scopes:</span>
              {app.grantedScopes.map((sc) => (
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
      )}

      {/* Tabs Header (Permissions vs Activity) */}
      <div className="border-t border-white/5 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('permissions');
              setExpanded(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'permissions'
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            Permissions ({app.actions?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('activity');
              setExpanded(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <span>Activity</span>
            {app.activity?.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#eb6920]/20 text-[#eb6920] text-[9px] font-bold flex items-center justify-center">
                {app.activity.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Content Panel */}
      {expanded && (
        <div className="mt-4 pt-2">
          {/* TAB 1: PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-3">
              <div className="text-[11px] text-gray-500 flex items-center justify-between px-1">
                <span>Configure what the agent may do in this application:</span>
                <span className="text-[10px] text-gray-500 italic">High/Critical actions require approval</span>
              </div>

              <div className="space-y-2">
                {app.actions.map((act) => {
                  const riskInfo = RISK_LEVELS[act.risk] || RISK_LEVELS.LOW;
                  const isHighOrCritical = act.risk === 'HIGH' || act.risk === 'CRITICAL';
                  const currentMode = act.mode || act.defaultMode || 'allowed';

                  return (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Action Info & Risk */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-white tracking-wide">{act.label}</span>
                          
                          {/* Risk Level Badge */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${riskInfo.badgeClass}`}>
                            {riskInfo.level}
                          </span>

                          {/* Approval requirement indicator */}
                          {(isHighOrCritical || currentMode === 'ask') && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              <Lock className="w-2.5 h-2.5" />
                              Always ask me
                            </span>
                          )}

                          {currentMode === 'off' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/10">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{act.description}</p>
                      </div>

                      {/* Permission Mode Selector Controls */}
                      <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 shrink-0 self-start md:self-auto">
                        {/* 1. ALLOWED (Run automatically) */}
                        {isHighOrCritical ? (
                          <div
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-600 bg-white/[0.02] cursor-not-allowed flex items-center gap-1"
                            title="Safety rule: High and Critical risk actions cannot be set to run without approval"
                          >
                            <Lock className="w-2.5 h-2.5 text-gray-600" />
                            <span>Allowed</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleModeChange(act.id, act.risk, 'allowed')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                              currentMode === 'allowed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                            }`}
                            title={PERMISSION_MODES.allowed.description}
                          >
                            Allowed
                          </button>
                        )}

                        {/* 2. ASK (Require approval) */}
                        <button
                          type="button"
                          onClick={() => handleModeChange(act.id, act.risk, 'ask')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            currentMode === 'ask'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm font-semibold'
                              : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                          }`}
                          title={PERMISSION_MODES.ask.description}
                        >
                          Ask me
                        </button>

                        {/* 3. OFF (Disabled) */}
                        <button
                          type="button"
                          onClick={() => handleModeChange(act.id, act.risk, 'off')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            currentMode === 'off'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-sm'
                              : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                          }`}
                          title={PERMISSION_MODES.off.description}
                        >
                          Disabled
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVITY AUDIT LOG */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div className="text-[11px] text-gray-500 flex items-center justify-between px-1">
                <span>Recent agent operations in {app.name}:</span>
                <span className="text-[10px] text-gray-500 italic">Audit log with cryptographic proof</span>
              </div>

              {!app.activity || app.activity.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-black/20 border border-white/5 text-gray-500 text-xs">
                  <Activity className="w-5 h-5 mx-auto mb-2 text-gray-600 opacity-60" />
                  No recorded actions in this app yet. Missions involving {app.name} will record audit logs here.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {app.activity.map((act) => (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold">{act.action}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400">
                            {act.status}
                          </span>
                          {act.simulated && (
                            <span className="text-[10px] font-medium text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              simulated
                            </span>
                          )}
                        </div>

                        <div className="text-gray-300 text-[11px] mb-1 font-medium">{act.result}</div>
                        <div className="text-gray-500 text-[10px]">
                          Mission: <span className="text-gray-400">{act.missionGoal}</span> · {act.timestamp}
                        </div>
                      </div>

                      {/* Proof Links */}
                      {act.evidence && act.evidence.length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          {act.evidence.map((ev, evIdx) => (
                            <a
                              key={evIdx}
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#eb6920] bg-[#eb6920]/10 hover:bg-[#eb6920]/20 border border-[#eb6920]/20 transition-all hover:scale-105"
                            >
                              <span>{ev.label}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disconnect Confirmation Dialog (Scope item 5 from Issue #10) */}
      {disconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0d0b13] border border-white/10 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-bold text-white mb-2">Disconnect {app.name}?</h4>
            
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              {app.disconnectWarning ||
                `Disconnecting ${app.name} will revoke AgentOS access. Any scheduled tasks or live missions using this app will be paused and require manual intervention.`}
            </p>

            {isGoogleApp && (
              <div className="mb-5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  All affected Google Workspace apps:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {affectedApps.map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2 text-xs text-gray-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#eb6920]" />
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition-colors"
              >
                Keep connected
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-1.5"
              >
                <Unplug className="w-3.5 h-3.5" />
                <span>{isGoogleApp ? 'Disconnect All Google Apps' : 'Disconnect'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Modal for Demo Mode */}
      {connectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0d0b13] border border-white/10 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            <div className="w-12 h-12 rounded-xl bg-[#eb6920]/10 border border-[#eb6920]/20 text-[#eb6920] flex items-center justify-center mb-4">
              <Plug className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-bold text-white mb-1">Connect {app.name}</h4>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Grant AgentOS permission to coordinate tasks in {app.name}.
            </p>

            <form onSubmit={handleConfirmConnect}>
              <div className="mb-5">
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Account Email / ID
                </label>
                <input
                  type="text"
                  required
                  value={connectEmail}
                  onChange={(e) => setConnectEmail(e.target.value)}
                  placeholder="e.g. user@agentos.org"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb6920]/60"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plug className="w-3.5 h-3.5" />
                  <span>Authorize & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
