import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { loadPreferences, savePreferences, clearPreferences, DEFAULT_PREFERENCES } from './preferences';
import { useAuth } from '../live/auth';
import { api } from '../live/api';

export function buildPreferencesPayload(prefs) {
  return {
    timezone: prefs?.timezone || 'UTC',
    workingDays: prefs?.workingDays || DEFAULT_PREFERENCES.workingDays,
    workingHours: prefs?.workingHours || DEFAULT_PREFERENCES.workingHours,
    displayName: prefs?.displayName || '',
    signature: prefs?.signature || '',
    tone: prefs?.tone || 'Friendly',
    meetingLength: Number(prefs?.meetingLength) || 30,
    groups: (prefs?.groups || []).map((g) => ({
      name: g.name,
      emails: g.emails || [],
    })),
    ...(prefs?.dismissedNudge !== undefined ? { dismissedNudge: prefs.dismissedNudge } : {}),
    ...(prefs?.onboardingDismissed !== undefined ? { onboardingDismissed: prefs.onboardingDismissed } : {}),
  };
}

export async function fetchLivePreferences(apiClient = api) {
  return await apiClient.getPreferences();
}

export async function saveLivePreferences(prefs, apiClient = api) {
  const payload = buildPreferencesPayload(prefs);
  return await apiClient.updatePreferences(payload);
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children, apiClient = api }) {
  // Read auth context safely; in Demo Mode or when unauthenticated, authContext will be null/falsy
  let authContext = null;
  try {
    authContext = useAuth();
  } catch {
    authContext = null;
  }
  const isAuthenticated = Boolean(authContext?.isAuthenticated);
  const user = authContext?.user;

  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState(null);

  const initialLoadedRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const latestPreferencesRef = useRef(preferences);
  latestPreferencesRef.current = preferences;

  // 1. In Live Mode when signed in: load GET /api/preferences after login and use it as source of truth
  useEffect(() => {
    if (!isAuthenticated || !user) {
      initialLoadedRef.current = false;
      return;
    }

    let active = true;
    fetchLivePreferences(apiClient)
      .then((serverPrefs) => {
        if (!active || !serverPrefs) return;
        setPreferences((prev) => {
          const merged = {
            ...DEFAULT_PREFERENCES,
            ...prev,
            ...serverPrefs,
            workingHours: serverPrefs.workingHours || prev.workingHours || DEFAULT_PREFERENCES.workingHours,
            workingDays: serverPrefs.workingDays || prev.workingDays || DEFAULT_PREFERENCES.workingDays,
            groups: Array.isArray(serverPrefs.groups)
              ? serverPrefs.groups.map((g) => ({
                  id: g.id || g.name,
                  name: g.name,
                  emails: g.emails || [],
                }))
              : prev.groups || [],
          };
          latestPreferencesRef.current = merged;
          return merged;
        });
        initialLoadedRef.current = true;
      })
      .catch(() => {
        initialLoadedRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, apiClient]);

  // Flush save immediately (cancels any pending debounce timer)
  const saveNow = useCallback(
    async (customPrefs) => {
      const prefsToSave = customPrefs || latestPreferencesRef.current;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (!isAuthenticated) {
        savePreferences(prefsToSave);
        setSaveStatus('saved');
        setSaveError(null);
        return;
      }

      setSaveStatus('saving');
      setSaveError(null);
      try {
        await saveLivePreferences(prefsToSave, apiClient);
        savePreferences(prefsToSave);
        setSaveStatus('saved');
        setSaveError(null);
      } catch (err) {
        setSaveStatus('error');
        setSaveError(err?.message || 'Failed to save preferences');
      }
    },
    [isAuthenticated, apiClient]
  );

  // 2. On change:
  // - Demo Mode (no backend or signed out): keep today's localStorage behaviour exactly.
  // - Live Mode when signed in: PUT /api/preferences debounced (~500 ms)
  const updatePreferences = useCallback(
    (updates) => {
      setPreferences((prev) => {
        const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
        latestPreferencesRef.current = next;

        // Demo Mode: keep today's localStorage behaviour exactly
        if (!isAuthenticated) {
          savePreferences(next);
          setSaveStatus('saved');
          setSaveError(null);
          return next;
        }

        // Live Mode: debounced PUT /api/preferences (~500 ms)
        savePreferences(next);
        setSaveStatus('saving');
        setSaveError(null);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          saveNow(next);
        }, 500);

        return next;
      });
    },
    [isAuthenticated, saveNow]
  );

  const resetPreferences = useCallback(() => {
    clearPreferences();
    setPreferences(DEFAULT_PREFERENCES);
    latestPreferencesRef.current = DEFAULT_PREFERENCES;
    if (isAuthenticated) {
      saveNow(DEFAULT_PREFERENCES);
    }
  }, [isAuthenticated, saveNow]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        resetPreferences,
        saveStatus,
        saveError,
        saveNow,
        isAuthenticated,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
