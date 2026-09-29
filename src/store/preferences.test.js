import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { loadPreferences, savePreferences, clearPreferences, DEFAULT_PREFERENCES, PREFERENCES_KEY, PREFERENCES_VERSION } from './preferences';

describe('Preferences persistence and validation', () => {
  beforeEach(() => {
    let store = {};
    global.window = {
      localStorage: {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, val) => { store[key] = val.toString(); }),
        removeItem: vi.fn(key => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
      }
    };
  });

  afterEach(() => {
    delete global.window;
  });

  it('loads defaults when empty', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('saves and loads preferences', () => {
    const prefs = { ...DEFAULT_PREFERENCES, tone: 'Formal', signature: 'My sig' };
    savePreferences(prefs);
    
    const loaded = loadPreferences();
    expect(loaded.tone).toBe('Formal');
    expect(loaded.signature).toBe('My sig');
  });

  it('recovers from malformed persistence', () => {
    window.localStorage.setItem(PREFERENCES_KEY, 'invalid json');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 999, preferences: {} }));
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('validates and falls back to defaults for invalid data', () => {
    const badPrefs = {
      ...DEFAULT_PREFERENCES,
      workingHours: { start: '18:00', end: '09:00' }, // end before start
      meetingLength: -10, // invalid
      workingDays: [], // empty
      groups: [{ name: '  ', emails: ['foo@bar.com'] }] // empty name
    };
    
    savePreferences(badPrefs);
    const loaded = loadPreferences();
    
    expect(loaded.workingHours).toEqual(DEFAULT_PREFERENCES.workingHours);
    expect(loaded.meetingLength).toBe(DEFAULT_PREFERENCES.meetingLength);
    expect(loaded.workingDays).toEqual(DEFAULT_PREFERENCES.workingDays);
    expect(loaded.groups).toEqual([]);
  });

  it('clears preferences on reset', () => {
    const prefs = { ...DEFAULT_PREFERENCES, tone: 'Formal' };
    savePreferences(prefs);
    expect(loadPreferences().tone).toBe('Formal');
    
    clearPreferences();
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
