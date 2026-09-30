import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, User, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../live/auth';
import { formatAuthError } from '../live/api';

export default function SignupPage() {
  const { signup, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const next = searchParams.get('next') || '/app';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // If already authenticated, redirect to next immediately
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, next]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signup({ email: email.trim(), password, name: name.trim() || undefined });
      navigate(next, { replace: true });
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07060a] text-gray-200 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link to="/" className="inline-flex items-center gap-2 group">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle size="sm" />
          <Link
            to="/app"
            className="text-xs font-semibold text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
          >
            <span>Demo Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Signup Card */}
      <main className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#eb6920]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#eb6920] uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" />
                Live Account
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Create your account</h1>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Connect your real everyday tools and run persistent autonomous missions with human-in-the-loop approvals.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5" htmlFor="signup-name">
                    Full name <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Chen"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#eb6920] focus:ring-1 focus:ring-[#eb6920] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5" htmlFor="signup-email">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex.chen@agentos.org"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#eb6920] focus:ring-1 focus:ring-[#eb6920] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5" htmlFor="signup-password">
                    Password <span className="text-gray-500 font-normal">(min. 8 characters)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="signup-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#eb6920] focus:ring-1 focus:ring-[#eb6920] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-orange w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-gray-400">
                Already have an account?{' '}
                <Link
                  to={`/login?next=${encodeURIComponent(next)}`}
                  className="font-semibold text-[#eb6920] hover:text-[#ff9a5c] transition-colors"
                >
                  Sign in
                </Link>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-gray-500 flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#eb6920] shrink-0 mt-0.5" />
                <span>
                  Cookies are httpOnly and sessions are never stored in localStorage.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-gray-600 py-4 max-w-5xl mx-auto w-full">
        AgentOS · Autonomous execution with human oversight
      </footer>
    </div>
  );
}
