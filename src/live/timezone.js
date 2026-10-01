import { api } from './api';

/**
 * Returns the current browser timezone using standard Intl API.
 * Falls back to 'UTC' if unavailable.
 */
export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Syncs the browser's timezone with the user's backend preferences.
 * - After a successful sign-up, or on login:
 *   If the saved timezone is still the default "UTC" (or missing),
 *   read Intl.DateTimeFormat().resolvedOptions().timeZone and save it with PUT /api/preferences.
 * - Never overwrite a timezone the user chose (anything other than "UTC").
 *
 * @param {object} apiClient - The API client to use (defaults to live api singleton)
 * @returns {Promise<{ updated: boolean, timezone: string, reason?: string, error?: any }>}
 */
export async function syncBrowserTimezone(apiClient = api) {
  try {
    const prefs = await apiClient.getPreferences();
    const savedTimezone = prefs?.timezone || 'UTC';

    // Never overwrite a timezone the user chose (anything other than "UTC")
    if (savedTimezone !== 'UTC') {
      return { updated: false, timezone: savedTimezone, reason: 'user_chosen' };
    }

    const browserTimezone = getBrowserTimezone();
    if (browserTimezone && browserTimezone !== 'UTC') {
      await apiClient.updatePreferences({
        ...prefs,
        timezone: browserTimezone,
      });
      return { updated: true, timezone: browserTimezone };
    }

    return { updated: false, timezone: 'UTC', reason: 'already_utc' };
  } catch (err) {
    // Fail safely without disrupting the authentication flow
    return { updated: false, error: err };
  }
}
