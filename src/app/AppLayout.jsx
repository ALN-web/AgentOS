import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppWindow, FlaskConical, Inbox, LayoutDashboard, LayoutTemplate, ListChecks, Network, Play, Plus, Sparkles, Settings, LogOut, User } from 'lucide-react';
import { Logo } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';
import ErrorBoundary from '../components/ErrorBoundary';
import ResetDemoButton from '../components/ResetDemoButton';
import BackendStatus from '../live/BackendStatus';
import { useAuth } from '../live/auth';
import { useMissions, usePendingApprovals } from '../store/MissionStore';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/missions', label: 'Missions', icon: ListChecks },
  { to: '/app/apps', label: 'Apps', icon: AppWindow },
  { to: '/app/workforce', label: 'Workforce', icon: Network },
  { to: '/app/features', label: 'Features', icon: Sparkles },
  { to: '/app/approvals', label: 'Approvals', icon: Inbox, badge: true },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

function NavItems({ pending, compact }) {
  return NAV.map(({ to, label, icon: Icon, end, badge }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
          compact ? 'px-3 py-2' : 'px-3 py-2.5'
        } ${isActive ? 'bg-white/[0.07] text-white' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'}`
      }
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge && pending > 0 && (
        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center">
          {pending}
          <span className="sr-only"> waiting</span>
        </span>
      )}
    </NavLink>
  ));
}

export default function AppLayout() {
  const { openLauncher, startDemo } = useMissions();
  const pending = usePendingApprovals().length;
  const navigate = useNavigate();
  const tryDemo = () => navigate(`/app/missions/${startDemo()}`);
  const { pathname } = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-white/5 bg-[#07060a] px-4 py-6">
        <div className="px-2 mb-8 flex items-center justify-between">
          <Logo size="md" />
          <ThemeToggle size="sm" />
        </div>
        <button onClick={tryDemo} className="btn-orange mb-2 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <Play className="w-3.5 h-3.5 fill-current" />
          Try Demo Mission
        </button>
        <button onClick={() => openLauncher()} className="btn-dark mb-6 w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          New mission
        </button>
        <nav className="flex flex-col gap-1" aria-label="Console">
          <NavItems pending={pending} />
        </nav>

        {/* User Account / Session Profile */}
        <div className="mt-auto mb-2">
          {isAuthenticated && user ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#eb6920] to-[#ff9a5c] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">{user.name || 'AgentOS User'}</div>
                  <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="text-[11px] text-gray-400 hover:text-red-400 flex items-center gap-1.5 transition-colors pt-1.5 border-t border-white/5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <NavLink
              to={`/login?next=${encodeURIComponent(pathname)}`}
              className="rounded-xl border border-white/5 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.05] p-2 text-xs text-gray-300 hover:text-white flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                <span>Sign in</span>
              </div>
              <span className="text-[10px] text-[#eb6920] font-medium group-hover:underline">Live Mode →</span>
            </NavLink>
          )}
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] text-gray-500 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-gray-300 mb-0.5">
            <FlaskConical className="w-3 h-3 text-[#eb6920]" />
            Demo environment
          </div>
          Agents run a scripted simulation in your browser.
          <div className="mt-1.5">
            <ResetDemoButton />
          </div>
        </div>
        <div className="mt-2">
          <BackendStatus />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-3 sm:px-4 h-14 flex items-center justify-between gap-1.5 overflow-hidden">
          <div className="shrink-0">
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle size="sm" />
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => logout()}
                title="Sign out"
                aria-label="Sign out"
                className="btn-dark px-2 h-8 rounded-lg flex items-center gap-1 text-xs text-gray-300 hover:text-red-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="sr-only">Sign out</span>
              </button>
            ) : (
              <NavLink
                to={`/login?next=${encodeURIComponent(pathname)}`}
                className="btn-dark px-2 sm:px-2.5 h-8 rounded-lg flex items-center gap-1 text-xs text-gray-300 hover:text-white"
              >
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">Sign in</span>
              </NavLink>
            )}
            <button onClick={() => openLauncher()} aria-label="New mission" className="btn-dark w-8 h-8 rounded-lg flex items-center justify-center">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={tryDemo} className="btn-orange px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
              <Play className="w-3 h-3 fill-current" />
              <span className="hidden xs:inline sm:inline">Try </span>
              <span>Demo</span>
            </button>
          </div>
        </div>
        <div className="px-3 sm:px-4 pb-1.5 flex items-center gap-1.5 text-[10px] text-gray-500 truncate">
          <FlaskConical className="w-3 h-3 text-[#eb6920] shrink-0" />
          <span className="truncate">Demo environment · all agent actions are simulated</span>
        </div>
        <nav className="px-3 pb-2 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Console">
          <NavItems pending={pending} compact />
        </nav>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1400px]">
        {/* Keyed by route so navigating away from a failed page recovers. */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
