import React, { useState, useEffect } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

export default function Navbar({ onOpenMissionModal }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Features', href: '#features' },
    { name: 'Architecture', href: '#architecture' },
    { name: 'Agents', href: '#agents' },
    { name: 'Mission Templates', href: '#mission-templates' },
    { name: 'About', href: '#about' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-[#000000]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)]' 
        : 'bg-transparent border-b border-white/5'
    }`}>
      <div className="max-w-[1240px] mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo matching REDSUN branding style from video */}
        <a href="#home" className="flex items-center gap-2 group">
          <div className="flex items-center tracking-wider text-xl font-extrabold text-white">
            <span>AGENT</span>
            <span className="text-[#eb6920]">OS</span>
            <div className="w-2.5 h-2.5 rounded-full bg-[#eb6920] ml-1 shadow-[0_0_10px_#eb6920] group-hover:scale-125 transition-transform" />
          </div>
        </a>

        {/* Center Desktop Navigation Items */}
        <div className="hidden lg:flex items-center space-x-7">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-[13.5px] font-medium text-gray-300 hover:text-white transition-colors tracking-wide hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            >
              {link.name}
            </a>
          ))}
          <span className="text-[13.5px] font-medium text-gray-400 cursor-pointer hover:text-white transition-colors">
            Cart (0)
          </span>
        </div>

        {/* Right CTA Button matching video */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={onOpenMissionModal}
            className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_20px_rgba(235,105,32,0.45)] hover:shadow-[0_0_30px_rgba(235,105,32,0.75)] hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <span>Launch Mission</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Mobile menu toggle */}
        <div className="lg:hidden flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0a080f]/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 space-y-4">
          <div className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base text-gray-300 hover:text-white py-2 border-b border-white/5"
              >
                {link.name}
              </a>
            ))}
            <div className="pt-2 flex justify-between items-center text-sm text-gray-400">
              <span>Cart</span>
              <span>(0)</span>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenMissionModal();
              }}
              className="w-full mt-4 py-3 rounded-full text-center text-sm font-semibold uppercase tracking-wider bg-gradient-to-r from-[#ff8c42] to-[#eb6920] text-white shadow-[0_0_20px_rgba(235,105,32,0.5)]"
            >
              Launch Mission
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
