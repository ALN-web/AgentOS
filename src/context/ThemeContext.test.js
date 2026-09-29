import { describe, it, expect } from 'vitest';
import { getInitialTheme, applyTheme, THEME_STORAGE_KEY } from './ThemeContext';

describe('Theme helpers', () => {
  it('has consistent storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('agentos_theme');
  });

  describe('getInitialTheme', () => {
    it('returns saved theme if valid', () => {
      expect(getInitialTheme('light', false)).toBe('light');
      expect(getInitialTheme('dark', false)).toBe('dark');
      expect(getInitialTheme('light', true)).toBe('light');
      expect(getInitialTheme('dark', true)).toBe('dark');
    });

    it('falls back to system preference if no valid saved theme', () => {
      expect(getInitialTheme(null, true)).toBe('light');
      expect(getInitialTheme(null, false)).toBe('dark');
      expect(getInitialTheme('invalid', true)).toBe('light');
      expect(getInitialTheme('invalid', false)).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    it('applies light theme classes and color-scheme', () => {
      const classes = new Set(['dark']);
      const style = {};
      const fakeEl = {
        classList: {
          add: (cls) => classes.add(cls),
          remove: (cls) => classes.delete(cls),
          contains: (cls) => classes.has(cls),
        },
        style,
      };

      applyTheme('light', fakeEl);

      expect(classes.has('light')).toBe(true);
      expect(classes.has('dark')).toBe(false);
      expect(style.colorScheme).toBe('light');
    });

    it('applies dark theme classes and color-scheme', () => {
      const classes = new Set(['light']);
      const style = {};
      const fakeEl = {
        classList: {
          add: (cls) => classes.add(cls),
          remove: (cls) => classes.delete(cls),
          contains: (cls) => classes.has(cls),
        },
        style,
      };

      applyTheme('dark', fakeEl);

      expect(classes.has('dark')).toBe(true);
      expect(classes.has('light')).toBe(false);
      expect(style.colorScheme).toBe('dark');
    });

    it('gracefully handles null target', () => {
      expect(() => applyTheme('dark', null)).not.toThrow();
    });
  });
});
