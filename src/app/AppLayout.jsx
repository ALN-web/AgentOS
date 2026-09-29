import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Inbox, LayoutDashboard, LayoutTemplate, ListChecks, Network, Plus, Sparkles } from 'lucide-react';
import { Logo } from '../components/ui';
import { useMissions, usePendingApprovals } from '../store/MissionStore';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/missions', label: 'Missions', icon: ListChecks },
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
          <span className="sr-only"> waiting</span>
          {pending}
        </span>
      )}
    </NavLink>
  ));
}

export default function AppLayout() {
  const { openLauncher } = useMissions();
  const pending = usePendingApprovals().length;

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-white/5 bg-[#07060a] px-4 py-6">
        <div className="px-2 mb-8">
          <Logo size="sm" />
        </div>
        <button onClick={() => openLauncher()} className="btn-orange mb-6 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          New mission
        </button>
        <nav className="flex flex-col gap-1" aria-label="Console">
          <NavItems pending={pending} />
        </nav>
        <div className="mt-auto px-3 text-[11px] text-gray-600 leading-relaxed">Don’t tell AI what to do. Tell it what you want done.</div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-black/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 h-14 flex items-center justify-between">
          <Logo size="sm" />
          <button onClick={() => openLauncher()} className="btn-orange px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
        <nav className="px-3 pb-2 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Console">
          <NavItems pending={pending} compact />
        </nav>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1400px]">
        <Outlet />
      </main>
    </div>
  );
}
