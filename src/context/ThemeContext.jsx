import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'agentos_theme';

export function getInitialTheme(savedTheme, systemPrefersLight = false) {
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  return systemPrefersLight ? 'light' : 'dark';
}

export function applyTheme(theme, target = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!target) return;
  if (theme === 'light') {
    target.classList?.remove('dark');
    target.classList?.add('light');
    if (target.style) target.style.colorScheme = 'light';
  } else {
    target.classList?.remove('light');
    target.classList?.add('dark');
    if (target.style) target.style.colorScheme = 'dark';
  }
}

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
      const prefersLight = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;
      return getInitialTheme(saved, prefersLight);
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (nextTheme) => {
    if (nextTheme === 'light' || nextTheme === 'dark') {
      setThemeState(nextTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
