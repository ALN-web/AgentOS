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
