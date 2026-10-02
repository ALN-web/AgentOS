import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import NewMissionModal from './NewMissionModal';
import { AuthProvider } from '../live/auth';
import { MissionProvider } from '../store/MissionStore';
import { PreferencesProvider } from '../store/PreferencesStore';
import * as backendStatusModule from '../live/useBackendStatus';

vi.mock('../live/useBackendStatus', () => ({
  useBackendStatus: vi.fn(),
}));

vi.mock('../hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    supported: false,
    listening: false,
    interimText: '',
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

function renderModal({ user = null, liveAvailable = false, launcherMode = undefined } = {}) {
  vi.spyOn(backendStatusModule, 'useBackendStatus').mockReturnValue({
    configured: true,
    status: 'connected',
    liveMode: { available: liveAvailable },
  });

  return renderToString(
    <MemoryRouter>
      <AuthProvider initialUser={user}>
        <PreferencesProvider>
          <MissionProvider initialLauncher={{ open: true, goal: 'Schedule a standup meeting', mode: launcherMode }}>
            <NewMissionModal />
          </MissionProvider>
        </PreferencesProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('NewMissionModal preselect Live Mode (#102)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preselects Live Mode when user is signed in and /api/health reports live_mode.available', () => {
    const html = renderModal({
      user: { id: 'u1', email: 'judge@example.com', name: 'Judge' },
      liveAvailable: true,
    });

    // Check that Live Mode has the selected styling classes (emerald background/border)
    expect(html).toContain('border-emerald-500/50 bg-emerald-500/15');
    // And Demo Mode is not selected (does not have orange active border)
    expect(html).not.toContain('border-[#eb6920]/50 bg-[#eb6920]/15');
  });

  it('defaults to Demo Mode when user is unauthenticated even if backend live mode is available', () => {
    const html = renderModal({
      user: null,
      liveAvailable: true,
    });

    expect(html).toContain('border-[#eb6920]/50 bg-[#eb6920]/15');
    expect(html).not.toContain('border-emerald-500/50 bg-emerald-500/15');
  });

  it('defaults to Demo Mode when backend reports live_mode.available is false', () => {
    const html = renderModal({
      user: { id: 'u1', email: 'judge@example.com', name: 'Judge' },
      liveAvailable: false,
    });

    expect(html).toContain('border-[#eb6920]/50 bg-[#eb6920]/15');
    expect(html).not.toContain('border-emerald-500/50 bg-emerald-500/15');
  });

  it('honors explicitly requested mode if provided via launcher options', () => {
    const html = renderModal({
      user: { id: 'u1', email: 'judge@example.com', name: 'Judge' },
      liveAvailable: true,
      launcherMode: 'demo',
    });

    expect(html).toContain('border-[#eb6920]/50 bg-[#eb6920]/15');
    expect(html).not.toContain('border-emerald-500/50 bg-emerald-500/15');
  });
});
