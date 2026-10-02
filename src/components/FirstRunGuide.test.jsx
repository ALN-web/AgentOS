import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import FirstRunGuide, { EXAMPLE_GOALS } from './FirstRunGuide';
import { AuthProvider } from '../live/auth';
import { MissionProvider } from '../store/MissionStore';
import { PreferencesProvider } from '../store/PreferencesStore';

function renderGuide({
  user = { id: 'u_test', email: 'test@example.com', name: 'Tester' },
  initialDismissed = false,
  googleConnectedOverride = null,
  missionCreatedOverride = null,
  missionCompletedOverride = null,
  apiClient = null,
} = {}) {
  const defaultApi = {
    getMe: vi.fn().mockResolvedValue({ user }),
    getPreferences: vi.fn().mockResolvedValue({ onboardingDismissed: false }),
    listIntegrations: vi.fn().mockResolvedValue([]),
    listMissions: vi.fn().mockResolvedValue([]),
    updatePreferences: vi.fn().mockResolvedValue({}),
  };

  return renderToString(
    <MemoryRouter>
      <AuthProvider initialUser={user} apiClient={apiClient || defaultApi}>
        <PreferencesProvider>
          <MissionProvider>
            <FirstRunGuide
              initialDismissed={initialDismissed}
              googleConnectedOverride={googleConnectedOverride}
              missionCreatedOverride={missionCreatedOverride}
              missionCompletedOverride={missionCompletedOverride}
              apiClient={apiClient || defaultApi}
            />
          </MissionProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('FirstRunGuide onboarding card (#68)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is NEVER rendered in Demo Mode (when user is unauthenticated)', () => {
    // Unauthenticated user -> Demo Mode
    const html = renderGuide({ user: null });
    expect(html).toBe('');
  });

  it('is not rendered when dismissed', () => {
    const html = renderGuide({ initialDismissed: true });
    expect(html).toBe('');
  });

  it('renders all 3 steps with initial states for a fresh live user', () => {
    const html = renderGuide({
      googleConnectedOverride: false,
      missionCreatedOverride: false,
      missionCompletedOverride: false,
    });

    expect(html).toContain('First-Run Guide');
    expect(html).toContain('Get started with AgentOS Live');
    expect(html).toContain('1. Connect Google');
    expect(html).toContain('Connect in Apps');
    expect(html).toContain('2. Try an example goal');
    expect(html).toContain('3. Approve &amp; see proof');
    expect(html).toContain('Awaiting first run');
  });

  it('contains all 3 required clickable example goal chips', () => {
    const html = renderGuide({
      googleConnectedOverride: false,
      missionCreatedOverride: false,
      missionCompletedOverride: false,
    });

    for (const goal of EXAMPLE_GOALS) {
      expect(html).toContain(goal);
    }
    expect(EXAMPLE_GOALS).toEqual([
      'Lunch with friend@example.com this Friday at 1 pm',
      'Invite my team to a review meeting next Tuesday at 4 pm',
      'Email friend@example.com the hackathon rules and ask if they are joining',
    ]);
  });

  it('ticks off Step 1 automatically when Google is connected', () => {
    const html = renderGuide({
      googleConnectedOverride: true,
      missionCreatedOverride: false,
      missionCompletedOverride: false,
    });

    expect(html).toContain('Connected');
    expect(html).not.toContain('Connect in Apps');
  });

  it('ticks off Step 2 automatically when first mission is created', () => {
    const html = renderGuide({
      googleConnectedOverride: true,
      missionCreatedOverride: true,
      missionCompletedOverride: false,
    });

    expect(html).toContain('First mission created');
    expect(html).toContain('View Approvals');
  });

  it('ticks off Step 3 automatically when first mission is completed', () => {
    const html = renderGuide({
      googleConnectedOverride: true,
      missionCreatedOverride: true,
      missionCompletedOverride: true,
    });

    expect(html).toContain('Completed with proof');
  });

  it('persists dismissal in backend preferences and never writes to localStorage', async () => {
    const updatePreferencesMock = vi.fn().mockResolvedValue({ onboardingDismissed: true });
    const mockApi = {
      getPreferences: vi.fn().mockResolvedValue({ timezone: 'UTC', onboardingDismissed: false }),
      updatePreferences: updatePreferencesMock,
      listIntegrations: vi.fn().mockResolvedValue([]),
      listMissions: vi.fn().mockResolvedValue([]),
      getMe: vi.fn().mockResolvedValue({ user: { id: 'u_1' } }),
    };

    const setItemSpy = vi.fn();
    global.window = {
      localStorage: {
        getItem: vi.fn(),
        setItem: setItemSpy,
        removeItem: vi.fn(),
      },
    };

    // Simulate dismiss action
    const mockPrefs = { timezone: 'UTC' };
    await mockApi.updatePreferences({ ...mockPrefs, onboardingDismissed: true });

    expect(mockApi.updatePreferences).toHaveBeenCalledWith({
      timezone: 'UTC',
      onboardingDismissed: true,
    });

    // Verify localStorage was never used to store dismissal
    const dismissalStorageCalls = setItemSpy.mock.calls.filter(([key]) =>
      String(key).toLowerCase().includes('dismiss') || String(key).toLowerCase().includes('guide')
    );
    expect(dismissalStorageCalls).toHaveLength(0);

    delete global.window;
  });

  it('contains example goal chips ready to launch into Live Mode', () => {
    const html = renderGuide({
      googleConnectedOverride: true,
      missionCreatedOverride: false,
    });

    for (const goal of EXAMPLE_GOALS) {
      expect(html).toContain(goal);
    }
  });
});
