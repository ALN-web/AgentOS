export const PREFERENCES_KEY = 'agentos.demo.preferences';
export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  workingHours: { start: '09:00', end: '18:00' },
  displayName: '',
  signature: '',
  tone: 'Friendly',
  meetingLength: 30,
  groups: [],
  dismissedNudge: false
};

function getStore() {
  try {
    const s = window.localStorage;
    s.setItem('__test__', '1');
    s.removeItem('__test__');
    return s;
  } catch {
    return null;
  }
}

export function loadPreferences() {
  const s = getStore();
  if (!s) return DEFAULT_PREFERENCES;
  try {
    const raw = s.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const data = JSON.parse(raw);
    if (!data || data.version !== PREFERENCES_VERSION || !data.preferences) return DEFAULT_PREFERENCES;
    
    const parsed = data.preferences;
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    
    // Minimal validation
    const timezone = (typeof parsed.timezone === 'string' && parsed.timezone.length > 0) ? parsed.timezone : DEFAULT_PREFERENCES.timezone;
    const tone = ['Friendly', 'Formal'].includes(parsed.tone) ? parsed.tone : DEFAULT_PREFERENCES.tone;
    const meetingLength = (typeof parsed.meetingLength === 'number' && parsed.meetingLength > 0) ? parsed.meetingLength : DEFAULT_PREFERENCES.meetingLength;
    const workingDays = Array.isArray(parsed.workingDays) && parsed.workingDays.length > 0 ? parsed.workingDays : DEFAULT_PREFERENCES.workingDays;
    
    const start = parsed.workingHours?.start || '09:00';
    const end = parsed.workingHours?.end || '18:00';
    const workingHours = (start < end) ? { start, end } : DEFAULT_PREFERENCES.workingHours;

    const groups = Array.isArray(parsed.groups) ? parsed.groups.filter(g => typeof g.name === 'string' && g.name.trim().length > 0) : [];
    
    const dismissedNudge = !!parsed.dismissedNudge;

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      timezone,
      tone,
      meetingLength,
      workingDays,
      workingHours,
      groups,
      dismissedNudge
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs) {
  const s = getStore();
  if (!s) return;
  try {
    s.setItem(PREFERENCES_KEY, JSON.stringify({
      version: PREFERENCES_VERSION,
      savedAt: Date.now(),
      preferences: prefs
    }));
  } catch {}
}

export function clearPreferences() {
  const s = getStore();
  if (!s) return;
  try {
    s.removeItem(PREFERENCES_KEY);
  } catch {}
}
