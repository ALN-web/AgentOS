import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppWindow, FlaskConical, Inbox, LayoutDashboard, LayoutTemplate, ListChecks, Network, Play, Plus, Sparkles } from 'lucide-react';
import { Logo } from '../components/ui';
import ErrorBoundary from '../components/ErrorBoundary';
import ResetDemoButton from '../components/ResetDemoButton';
import BackendStatus from '../live/BackendStatus';
import { useMissions, usePendingApprovals } from '../store/MissionStore';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/missions', label: 'Missions', icon: ListChecks },
  { to: '/app/apps', label: 'Apps', icon: AppWindow },
  { to: '/app/workforce', label: 'Workforce', icon: Network },
  { to: '/app/features', label: 'Features', icon: Sparkles },
  { to: '/app/approvals', label: 'Approvals', icon: Inbox, badge: true },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
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

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-white/5 bg-[#07060a] px-4 py-6">
        <div className="px-2 mb-8">
          <Logo size="md" />
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
        <div className="mt-auto rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-gray-300 mb-0.5">
            <FlaskConical className="w-3 h-3 text-[#eb6920]" />
            Demo environment
          </div>
          Agents run a scripted simulation in your browser. No emails are sent and no external sites are contacted.
          <div className="mt-2">
            <ResetDemoButton />
          </div>
        </div>
        <div className="mt-2">
          <BackendStatus />
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 h-14 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <button onClick={() => openLauncher()} aria-label="New mission" className="btn-dark w-8 h-8 rounded-lg flex items-center justify-center">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={tryDemo} className="btn-orange px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Play className="w-3 h-3 fill-current" />
              Try Demo
            </button>
          </div>
        </div>
        <div className="px-4 pb-1.5 flex items-center gap-1.5 text-[10px] text-gray-500">
          <FlaskConical className="w-3 h-3 text-[#eb6920]" />
          Demo environment · all agent actions are simulated
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
