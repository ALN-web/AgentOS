import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './auth';

export default function ProtectedRoute({ children, fallbackNext }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-8 text-center" data-testid="auth-loading">
        <Loader2 className="w-8 h-8 text-[#eb6920] animate-spin" />
        <div className="text-xs font-semibold text-gray-400">Verifying session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const nextPath = fallbackNext ?? `${location.pathname}${location.search}`;
    const loginUrl = `/login?next=${encodeURIComponent(nextPath)}`;
    return <Navigate to={loginUrl} replace />;
  }

  return children ? children : <Outlet />;
}
