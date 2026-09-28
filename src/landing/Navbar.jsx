import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '../components/ui';
import { useMissions } from '../store/MissionStore';

const NAV_LINKS = [
  { name: 'How it works', href: '#how-it-works' },
  { name: 'Agents', href: '#agents' },
  { name: 'Templates', href: '#templates' },
];

export default function Navbar() {
  const { openLauncher } = useMissions();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/10' : 'bg-transparent border-b border-white/5'
      }`}
    >
      <div className="max-w-[1240px] mx-auto px-6 h-20 flex items-center justify-between">
        <Logo />

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a key={link.name} href={link.href} className="text-[13.5px] font-medium text-gray-300 hover:text-white transition-colors">
              {link.name}
            </a>
          ))}
          <Link to="/app" className="text-[13.5px] font-medium text-gray-300 hover:text-white transition-colors">
            Console
          </Link>
        </div>

        <button
          onClick={() => openLauncher()}
          className="hidden md:inline-flex group items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase btn-orange"
        >
          Launch mission
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#0a080f]/95 backdrop-blur-2xl border-b border-white/10 px-6 py-5 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <a key={link.name} href={link.href} onClick={() => setOpen(false)} className="text-base text-gray-300 hover:text-white py-2.5 border-b border-white/5">
              {link.name}
            </a>
          ))}
          <Link to="/app" className="text-base text-gray-300 hover:text-white py-2.5 border-b border-white/5">
            Console
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              openLauncher();
            }}
            className="w-full mt-4 py-3 rounded-full text-sm font-semibold uppercase tracking-wider btn-orange"
          >
            Launch mission
          </button>
        </div>
      )}
    </nav>
  );
}
