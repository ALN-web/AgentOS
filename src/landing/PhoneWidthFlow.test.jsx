import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Hero from './Hero';
import Dashboard from '../app/Dashboard';
import NewMissionModal from '../components/NewMissionModal';
import { AuthProvider } from '../live/auth';
import { MissionProvider } from '../store/MissionStore';
import { PreferencesProvider } from '../store/PreferencesStore';
import * as backendStatusModule from '../live/useBackendStatus';

vi.mock('../live/useBackendStatus', () => ({
  useBackendStatus: vi.fn(() => ({ configured: true, status: 'connected', liveMode: { available: true } })),
}));

describe('Phone-width flow responsive ergonomics (#102)', () => {
  it('Hero has responsive font sizing and full-width CTA buttons', () => {
    const html = renderToString(
      <MemoryRouter>
        <AuthProvider initialUser={null}>
          <PreferencesProvider>
            <MissionProvider>
              <Hero />
            </MissionProvider>
          </PreferencesProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Responsive heading
    expect(html).toContain('text-4xl sm:text-6xl');
    // Full width button on phone
    expect(html).toContain('w-full sm:w-auto');
  });

  it('Dashboard header CTAs expand to full width on phone screens', () => {
    const html = renderToString(
      <MemoryRouter>
        <AuthProvider initialUser={null}>
          <PreferencesProvider>
            <MissionProvider>
              <Dashboard />
            </MissionProvider>
          </PreferencesProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('w-full sm:w-auto');
    expect(html).toContain('Get started — connect your Google');
  });

  it('NewMissionModal uses single-column layout on phone screens for execution mode', () => {
    const html = renderToString(
      <MemoryRouter>
        <AuthProvider initialUser={null}>
          <PreferencesProvider>
            <MissionProvider initialLauncher={{ open: true, goal: 'Plan event' }}>
              <NewMissionModal />
            </MissionProvider>
          </PreferencesProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('grid grid-cols-1 sm:grid-cols-2');
  });
});
