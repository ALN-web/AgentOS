import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ size = 'md', showLabel = false, className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const btnSize = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eb6920] ${
        showLabel ? 'px-3 py-1.5' : btnSize
      } ${
        isLight
          ? 'bg-slate-200/80 border border-slate-300 text-slate-800 hover:text-slate-950 hover:bg-slate-300/80 hover:border-[#eb6920]/50 shadow-sm'
          : 'bg-white/[0.06] border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.12] hover:border-[#eb6920]/40 shadow-[0_0_12px_rgba(0,0,0,0.4)]'
      } ${className}`}
    >
      {isLight ? (
        <Sun className={`${iconSize} text-amber-500 transition-transform duration-300 rotate-0 hover:rotate-45`} />
      ) : (
        <Moon className={`${iconSize} text-slate-300 transition-transform duration-300 -rotate-12 hover:rotate-0`} />
      )}
      {showLabel && (
        <span className="text-xs font-semibold select-none">
          {isLight ? 'Light mode' : 'Dark mode'}
        </span>
      )}
    </button>
  );
}
