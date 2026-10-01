import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api, formatAuthError } from './api';

export function normalizeUser(res) {
  if (!res) return null;
  const u = res.user ?? res;
  if (!u || typeof u !== 'object') return null;
  return {
    ...u,
    id: u.id,
    email: u.email,
    name: u.name ?? u.full_name ?? u.displayName ?? undefined,
  };
}

export function getProtectedRedirect(isAuthenticated, currentPath = '/app') {
  if (!isAuthenticated) {
    return `/login?next=${encodeURIComponent(currentPath)}`;
  }
  return null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children, initialUser = null, apiClient = api }) {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(initialUser === null);
  const [error, setError] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiClient.getMe();
      const nextUser = normalizeUser(res);
      setUser(nextUser);
      setError(null);
      return nextUser;
    } catch (err) {
      // 401 / unauthenticated / backend not reachable or not configured
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (initialUser !== null) {
      setLoading(false);
      return;
    }
    refreshUser();
  }, [refreshUser, initialUser]);

  const login = useCallback(
    async ({ email, password }) => {
      setError(null);
      try {
        const res = await apiClient.login({ email, password });
        const loggedInUser = normalizeUser(res);
        setUser(loggedInUser);
        return loggedInUser;
      } catch (err) {
        const message = formatAuthError(err);
        setError(message);
        throw err;
      }
    },
    [apiClient]
  );

  const signup = useCallback(
    async ({ email, password, name }) => {
      setError(null);
      try {
        const res = await apiClient.signup({ email, password, name });
        const signedUpUser = normalizeUser(res);
        setUser(signedUpUser);
        return signedUpUser;
      } catch (err) {
        const message = formatAuthError(err);
        setError(message);
        throw err;
      }
    },
    [apiClient]
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Even if network failed or session was already expired, clear local state
    } finally {
      setUser(null);
      setError(null);
    }
  }, [apiClient]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      setError,
      isAuthenticated: Boolean(user),
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, loading, error, login, signup, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
