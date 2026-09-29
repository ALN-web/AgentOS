import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadPreferences, savePreferences, clearPreferences, DEFAULT_PREFERENCES } from './preferences';

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(() => loadPreferences());

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const updatePreferences = (updates) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const resetPreferences = () => {
    clearPreferences();
    setPreferences(DEFAULT_PREFERENCES);
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
