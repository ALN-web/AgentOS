import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { name: 'How it works', href: '#how-it-works' },
      { name: 'Agents', href: '#agents' },
      { name: 'Templates', href: '#templates' },
    ],
  },
  {
    title: 'Console',
    links: [
      { name: 'Dashboard', to: '/app' },
      { name: 'Missions', to: '/app/missions' },
      { name: 'Workforce', to: '/app/workforce' },
      { name: 'Approvals', to: '/app/approvals' },
    ],
  },
  {
    title: 'Project',
    links: [{ name: 'GitHub', href: 'https://github.com/ALN-web/AgentOS', external: true }],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 pt-16 pb-10">
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/5">
          <div className="md:col-span-5 space-y-4">
            <Logo />
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              Don’t tell AI what to do. Tell it what you want done.
            </p>
          </div>

          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white mb-4">{col.title}</div>
                <ul className="space-y-2.5 text-sm text-gray-400">
                  {col.links.map((l) => (
                    <li key={l.name}>
                      {l.to ? (
                        <Link to={l.to} className="hover:text-[#eb6920] transition-colors">
                          {l.name}
                        </Link>
                      ) : (
                        <a
                          href={l.href}
                          {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                          className="hover:text-[#eb6920] transition-colors"
                        >
                          {l.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8 text-xs text-gray-500">© 2026 AgentOS</div>
      </div>
    </footer>
  );
}
