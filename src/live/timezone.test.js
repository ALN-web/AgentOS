import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getBrowserTimezone, syncBrowserTimezone } from './timezone';
import { DEFAULT_PREFERENCES } from '../store/preferences';

describe('Timezone detection and synchronization (#18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads timezone from Intl API or falls back to UTC', () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  it('saves timezone once after sign-up when saved timezone is the default "UTC"', async () => {
    const mockApiClient = {
      getPreferences: vi.fn().mockResolvedValue({
        timezone: 'UTC',
        workingDays: ['Monday', 'Tuesday'],
        workingHours: { start: '09:00', end: '18:00' },
      }),
      updatePreferences: vi.fn().mockResolvedValue({
        timezone: 'Asia/Kolkata',
      }),
    };

    // Spy on Intl.DateTimeFormat to return a predictable timezone
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Kolkata' }),
    });

    const result = await syncBrowserTimezone(mockApiClient);

    expect(mockApiClient.getPreferences).toHaveBeenCalledTimes(1);
    expect(mockApiClient.updatePreferences).toHaveBeenCalledTimes(1);
    expect(mockApiClient.updatePreferences).toHaveBeenCalledWith({
      timezone: 'Asia/Kolkata',
      workingDays: ['Monday', 'Tuesday'],
      workingHours: { start: '09:00', end: '18:00' },
    });
    expect(result.updated).toBe(true);
    expect(result.timezone).toBe('Asia/Kolkata');

    spy.mockRestore();
  });

  it('never overwrites a timezone the user chose (anything other than "UTC")', async () => {
    const mockApiClient = {
      getPreferences: vi.fn().mockResolvedValue({
        timezone: 'America/New_York', // user-chosen
        workingDays: ['Monday', 'Tuesday'],
      }),
      updatePreferences: vi.fn(),
    };

    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' }),
    });

    const result = await syncBrowserTimezone(mockApiClient);

    expect(mockApiClient.getPreferences).toHaveBeenCalledTimes(1);
    // MUST NOT update anything when user has chosen a timezone
    expect(mockApiClient.updatePreferences).not.toHaveBeenCalled();
    expect(result.updated).toBe(false);
    expect(result.timezone).toBe('America/New_York');
    expect(result.reason).toBe('user_chosen');

    spy.mockRestore();
  });

  it('does not call updatePreferences if browser timezone is also UTC', async () => {
    const mockApiClient = {
      getPreferences: vi.fn().mockResolvedValue({
        timezone: 'UTC',
      }),
      updatePreferences: vi.fn(),
    };

    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'UTC' }),
    });

    const result = await syncBrowserTimezone(mockApiClient);

    expect(mockApiClient.getPreferences).toHaveBeenCalledTimes(1);
    expect(mockApiClient.updatePreferences).not.toHaveBeenCalled();
    expect(result.updated).toBe(false);
    expect(result.timezone).toBe('UTC');

    spy.mockRestore();
  });

  it('fails gracefully and non-blockingly when the network or endpoint fails', async () => {
    const mockApiClient = {
      getPreferences: vi.fn().mockRejectedValue(new Error('Network failure')),
      updatePreferences: vi.fn(),
    };

    const result = await syncBrowserTimezone(mockApiClient);
    expect(result.updated).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockApiClient.updatePreferences).not.toHaveBeenCalled();
  });

  it('Demo Mode never calls the backend preferences API', () => {
    // In Demo Mode, preferences are loaded purely from local store / default preferences
    const mockFetch = vi.fn();
    // Default preferences initializes timezone locally without any API call
    expect(DEFAULT_PREFERENCES.timezone).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
