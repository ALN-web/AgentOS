import React, { useState, useMemo } from 'react';
import {
  AppWindow,
  Search,
  ShieldCheck,
  Lock,
  Layers,
  Sparkles,
  CheckCircle2,
  Plug,
  Activity,
  Filter,
  Loader2,
} from 'lucide-react';
import AppCard from '../components/AppCard';
import { useConnectedApps } from '../live/useConnectedApps';
import GoogleConnectControl from '../live/GoogleConnectControl';
import { COLD_START_MESSAGE } from '../live/useBackendStatus';

export default function ConnectedApps() {
  const { apps, integrations, isLive, loading, error, updatePermission, disconnect, connect } = useConnectedApps();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'connected' | 'needs_reconnect' | 'not_connected' | 'demo' | 'coming_soon'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'Google Workspace' | 'Communication' | 'Productivity'

  // Computed metrics
  const stats = useMemo(() => {
    let connectedCount = 0;
    let totalActions = 0;
    let safetyLockedCount = 0;
    let totalActivities = 0;

    for (const app of apps) {
      if (app.status === 'connected') connectedCount++;
      for (const act of app.actions || []) {
        totalActions++;
        if (act.risk === 'HIGH' || act.risk === 'CRITICAL') {
          safetyLockedCount++;
        }
      }
      totalActivities += (app.activity || []).length;
    }

    return { connectedCount, totalActions, safetyLockedCount, totalActivities };
  }, [apps]);

  // Categories list
  const categories = ['all', 'Google Workspace', 'Communication', 'Productivity'];

  // Filtered apps
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      // Search match
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.provider.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.actions.some((a) => a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));

      // Status match
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'connected' && app.status === 'connected') ||
        ((statusFilter === 'needs_reconnect' || statusFilter === 'reconnect') && app.status === 'needs_reconnect') ||
        (statusFilter === 'not_connected' && (app.status === 'available' || app.status === 'not_connected' || app.status === 'demo')) ||
        (statusFilter === 'available' && (app.status === 'available' || app.status === 'not_connected')) ||
        (statusFilter === 'demo' && app.status === 'demo') ||
        (statusFilter === 'coming_soon' && app.status === 'coming_soon');

      // Category match
      const matchCategory = categoryFilter === 'all' || app.category === categoryFilter;

      return matchSearch && matchStatus && matchCategory;
    });
  }, [apps, search, statusFilter, categoryFilter]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold uppercase tracking-wider text-[#eb6920] mb-2">
            <AppWindow className="w-3.5 h-3.5" />
            <span>Everyday App Catalogue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Connected Apps</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            One place to inspect which everyday apps AgentOS can work with, what it is allowed to do in each, and what it has done there.
          </p>
        </div>

        {/* Live vs Demo Environment Indicator */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {isLive ? (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Backend Connected</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Demo Mode · Static Catalogue</span>
            </div>
          )}
        </div>
      </div>

      {/* Friendly cold start alert banner if server waking up */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#eb6920] shrink-0" />
            <span>{COLD_START_MESSAGE}</span>
          </div>
          <button onClick={() => window.location.reload()} className="underline hover:text-white font-medium ml-2">
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards (matching Dashboard.jsx layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Connected</span>
            <Plug className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 tabular-nums">
            {stats.connectedCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Active app integrations</div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Everyday Apps</span>
            <Layers className="w-4 h-4 text-[#eb6920]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
            {apps.length}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">In official catalogue</div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Safety Locked</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 tabular-nums">
            {stats.safetyLockedCount}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Never runs without approval</div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Audit Records</span>
            <ShieldCheck className="w-4 h-4 text-[#eb6920]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
            {stats.totalActivities}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Verified action proofs</div>
        </div>
      </div>

      {/* Google Integration Control */}
      {isLive && <GoogleConnectControl apps={apps} integrations={integrations} />}

      {/* Safety Policy Notice Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#171321] to-[#0f0d16] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#eb6920]/10 border border-[#eb6920]/20 flex items-center justify-center text-[#eb6920] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide">
              Zero-Surprise Permission Model
            </h4>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Every action is mapped to a strict risk level (LOW, MEDIUM, HIGH, CRITICAL). High and Critical risk actions cannot run autonomously—they always halt for your explicit approval before modifying any external data.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps, providers, or actions..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#eb6920]/60 transition-colors"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: 'All' },
            ...(isLive
              ? [
                  { id: 'connected', label: 'Connected' },
                  { id: 'needs_reconnect', label: 'Reconnect' },
                  { id: 'not_connected', label: 'Not connected' },
                ]
              : [
                  { id: 'connected', label: 'Connected' },
                  { id: 'not_connected', label: 'Not connected' },
                ]),
            { id: 'demo', label: 'Demo' },
            { id: 'coming_soon', label: 'Coming soon' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-white/[0.08] text-white shadow-sm border border-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" />
          Category:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
              categoryFilter === cat
                ? 'bg-[#eb6920]/20 text-[#eb6920] border border-[#eb6920]/40 font-semibold'
                : 'text-gray-400 hover:text-gray-200 bg-white/[0.03] border border-white/5'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* App Cards List */}
      {filteredApps.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <AppWindow className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No matching apps found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
            Try adjusting your search query or switching filters to view all apps in the catalogue.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
            className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onUpdatePermission={updatePermission}
              onDisconnect={disconnect}
              onConnect={connect}
              isLive={isLive}
              allApps={apps}
            />
          ))}
        </div>
      )}
    </div>
  );
}
