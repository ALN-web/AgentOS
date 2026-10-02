import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../live/auth';
import { api } from '../live/api';
import { useMissions } from '../store/MissionStore';

export const EXAMPLE_GOALS = [
  'Lunch with friend@example.com this Friday at 1 pm',
  'Invite my team to a review meeting next Tuesday at 4 pm',
  'Email friend@example.com the hackathon rules and ask if they are joining',
];

export default function FirstRunGuide({
  // Optional props for direct testing / isolation
  initialDismissed = false,
  googleConnectedOverride = null,
  missionCreatedOverride = null,
  missionCompletedOverride = null,
  onDismissCallback = null,
  apiClient = api,
}) {
  const { isAuthenticated } = useAuth();
  const { openLauncher, missions: localMissions } = useMissions();

  const [dismissed, setDismissed] = useState(initialDismissed);
  const [googleConnected, setGoogleConnected] = useState(googleConnectedOverride ?? false);
  const [missionCreated, setMissionCreated] = useState(missionCreatedOverride ?? false);
  const [missionCompleted, setMissionCompleted] = useState(missionCompletedOverride ?? false);
  const [serverPrefs, setServerPrefs] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    // Fetch initial status from backend
    Promise.all([
      apiClient.getPreferences().catch(() => null),
      googleConnectedOverride === null ? apiClient.listIntegrations().catch(() => []) : Promise.resolve(null),
      missionCreatedOverride === null ? apiClient.listMissions().catch(() => []) : Promise.resolve(null),
    ]).then(([prefs, integrations, liveMissions]) => {
      if (!active) return;

      if (prefs) {
        setServerPrefs(prefs);
        if (prefs.onboardingDismissed) {
          setDismissed(true);
        }
      }

      if (googleConnectedOverride === null && Array.isArray(integrations)) {
        const isConnected = integrations.some(
          (i) => i.provider === 'google' && (i.status === 'connected' || i.connected === true)
        );
        setGoogleConnected(isConnected);
      }

      if (missionCreatedOverride === null && Array.isArray(liveMissions)) {
        const hasCreated = liveMissions.length > 0;
        const hasCompleted = liveMissions.some((m) => m.status === 'completed' || m.status === 'done');
        setMissionCreated(hasCreated);
        if (missionCompletedOverride === null) {
          setMissionCompleted(hasCompleted);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, apiClient, googleConnectedOverride, missionCreatedOverride, missionCompletedOverride]);

  // Keep in sync with local missions if live missions match
  useEffect(() => {
    if (missionCreatedOverride !== null) return;
    if (localMissions && localMissions.some((m) => m.isLive || m.status)) {
      setMissionCreated(true);
      if (localMissions.some((m) => m.status === 'completed' || m.status === 'done')) {
        setMissionCompleted(true);
      }
    }
  }, [localMissions, missionCreatedOverride]);

  // Never render in Demo Mode
  if (!isAuthenticated || dismissed) {
    return null;
  }

  const handleDismiss = async () => {
    setDismissed(true);
    if (onDismissCallback) onDismissCallback();
    try {
      await apiClient.updatePreferences({
        ...(serverPrefs || {}),
        onboardingDismissed: true,
      });
    } catch {
      // Non-blocking
    }
  };

  const handleSelectGoal = (exampleGoal) => {
    openLauncher(exampleGoal);
  };

  return (
    <section
      data-testid="first-run-guide"
      className="glass-card rounded-2xl p-5 sm:p-6 mb-8 border border-white/10 relative overflow-hidden bg-white/[0.02]"
    >
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#eb6920]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#eb6920] uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>First-Run Guide</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Get started with AgentOS Live</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Complete these 3 simple steps to see autonomous agents plan, execute, and verify your workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          data-testid="dismiss-guide-btn"
          aria-label="Dismiss first-run guide"
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 3 Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1: Connect Google */}
        <div
          data-testid="guide-step-1"
          className={`p-4 rounded-xl border transition-all ${
            googleConnected
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-white/10 bg-black/40 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            {googleConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-[#eb6920]/40 bg-[#eb6920]/10 flex items-center justify-center text-[10px] font-bold text-[#eb6920] shrink-0">
                1
              </div>
            )}
            <h3 className="text-sm font-semibold text-white">1. Connect Google</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Grant permission for AgentOS to manage your calendar, draft emails, and access files safely.
          </p>
          {googleConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <Link
              to="/app/live/apps"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#eb6920] hover:text-[#ff8a4c] transition-colors"
            >
              <span>Connect in Apps</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* Step 2: Try an example goal */}
        <div
          data-testid="guide-step-2"
          className={`p-4 rounded-xl border transition-all ${
            missionCreated
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-white/10 bg-black/40 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            {missionCreated ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-[#eb6920]/40 bg-[#eb6920]/10 flex items-center justify-center text-[10px] font-bold text-[#eb6920] shrink-0">
                2
              </div>
            )}
            <h3 className="text-sm font-semibold text-white">2. Try an example goal</h3>
          </div>
          <p className="text-xs text-gray-400 mb-2">Pick an example to pre-fill the New Mission window:</p>
          <div className="space-y-1.5">
            {EXAMPLE_GOALS.map((goalText) => (
              <button
                key={goalText}
                type="button"
                onClick={() => handleSelectGoal(goalText)}
                className="w-full text-left text-[11px] leading-snug px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-[#eb6920]/60 hover:bg-[#eb6920]/10 text-gray-300 hover:text-white transition-all cursor-pointer block truncate"
                title={goalText}
              >
                &ldquo;{goalText}&rdquo;
              </button>
            ))}
          </div>
          {missionCreated && (
            <div className="mt-2 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              First mission created
            </div>
          )}
        </div>

        {/* Step 3: Approve, then see proof */}
        <div
          data-testid="guide-step-3"
          className={`p-4 rounded-xl border transition-all ${
            missionCompleted
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-white/10 bg-black/40 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            {missionCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-white/20 bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                3
              </div>
            )}
            <h3 className="text-sm font-semibold text-white">3. Approve & see proof</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Sensitive actions request approval first. Once executed, review genuine cryptographic proof of all outcomes.
          </p>
          {missionCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed with proof
            </span>
          ) : missionCreated ? (
            <Link
              to="/app/live/approvals"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#eb6920] hover:text-[#ff8a4c] transition-colors"
            >
              <span>View Approvals</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            <span className="text-xs text-gray-500 italic">Awaiting first run</span>
          )}
        </div>
      </div>
    </section>
  );
}
