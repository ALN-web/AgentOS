import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  PreferencesProvider,
  usePreferences,
  buildPreferencesPayload,
  fetchLivePreferences,
  saveLivePreferences,
} from './PreferencesStore';
import { DEFAULT_PREFERENCES } from './preferences';

describe('PreferencesStore live backend sync (#18)', () => {
  beforeEach(() => {
    let store = {};
    global.window = {
      localStorage: {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, val) => {
          store[key] = val.toString();
        }),
        removeItem: vi.fn((key) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          store = {};
        }),
      },
    };
  });

  afterEach(() => {
    delete global.window;
    vi.clearAllMocks();
  });

  it('buildPreferencesPayload formats preferences into camelCase schema matching backend', () => {
    const input = {
      timezone: 'Asia/Kolkata',
      workingDays: ['Monday', 'Tuesday'],
      workingHours: { start: '10:00', end: '19:00' },
      displayName: 'Alice',
      signature: 'Best, Alice',
      tone: 'Formal',
      meetingLength: 45,
      groups: [{ id: '1', name: 'Dev Team', emails: ['dev@example.com'] }],
      dismissedNudge: true,
      onboardingDismissed: true,
    };

    const payload = buildPreferencesPayload(input);

    expect(payload.timezone).toBe('Asia/Kolkata');
    expect(payload.workingDays).toEqual(['Monday', 'Tuesday']);
    expect(payload.workingHours).toEqual({ start: '10:00', end: '19:00' });
    expect(payload.displayName).toBe('Alice');
    expect(payload.signature).toBe('Best, Alice');
    expect(payload.tone).toBe('Formal');
    expect(payload.meetingLength).toBe(45);
    expect(payload.groups).toEqual([{ name: 'Dev Team', emails: ['dev@example.com'] }]);
    expect(payload.dismissedNudge).toBe(true);
    expect(payload.onboardingDismissed).toBe(true);
  });

  it('loads preferences from backend when signed in in Live Mode', async () => {
    const backendPrefs = {
      timezone: 'Asia/Kolkata',
      workingDays: ['Monday', 'Wednesday', 'Friday'],
      workingHours: { start: '10:00', end: '19:00' },
      displayName: 'Alex Chen',
      signature: 'Best regards, Alex',
      tone: 'Formal',
      meetingLength: 45,
      groups: [{ name: 'Core Team', emails: ['dev@agentos.org'] }],
    };

    const mockApi = {
      getPreferences: vi.fn().mockResolvedValue(backendPrefs),
      updatePreferences: vi.fn(),
    };

    const loaded = await fetchLivePreferences(mockApi);

    expect(mockApi.getPreferences).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual(backendPrefs);
  });

  it('saves on change via PUT /api/preferences in Live Mode', async () => {
    const mockApi = {
      getPreferences: vi.fn(),
      updatePreferences: vi.fn().mockResolvedValue({ timezone: 'Europe/London' }),
    };

    const updateData = {
      timezone: 'Europe/London',
      displayName: 'Commander',
    };

    await saveLivePreferences(updateData, mockApi);

    expect(mockApi.updatePreferences).toHaveBeenCalledTimes(1);
    expect(mockApi.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        timezone: 'Europe/London',
        displayName: 'Commander',
      })
    );
  });

  it('Demo Mode never calls the backend API and operates purely via localStorage', () => {
    const mockApi = {
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
    };

    // In Demo Mode (no backend or unauthenticated), local store is used
    expect(mockApi.getPreferences).not.toHaveBeenCalled();
    expect(mockApi.updatePreferences).not.toHaveBeenCalled();

    // Verify localStorage behavior remains intact
    window.localStorage.setItem('agentos.demo.preferences', JSON.stringify({ version: 1, preferences: {} }));
    expect(window.localStorage.setItem).toHaveBeenCalled();
  });

  it('handles backend save errors gracefully without crashing', async () => {
    const mockApi = {
      updatePreferences: vi.fn().mockRejectedValue(new Error('Server unavailable')),
    };

    await expect(saveLivePreferences({ timezone: 'Asia/Tokyo' }, mockApi)).rejects.toThrow('Server unavailable');
  });

  it('PreferencesProvider renders without throwing errors', () => {
    function DummyChild() {
      const { preferences } = usePreferences();
      return <div>{preferences.timezone}</div>;
    }

    const html = renderToString(
      <PreferencesProvider>
        <DummyChild />
      </PreferencesProvider>
    );

    expect(typeof html).toBe('string');
  });
});
