import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Hero from './Hero';
import Dashboard from '../app/Dashboard';
import { AuthProvider } from '../live/auth';
import { MissionProvider } from '../store/MissionStore';
import { PreferencesProvider } from '../store/PreferencesStore';

describe('Live-first experience CTAs (#102)', () => {
  it('Hero renders "Get started — connect your Google" as primary CTA and "Try Demo" as secondary', () => {
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

    expect(html).toContain('Get started — connect your Google');
    expect(html).toContain('Try Demo');
    expect(html).not.toContain('Try Demo Mission');
  });

  it('Dashboard renders "Get started — connect your Google" as primary CTA and "Try Demo" as secondary', () => {
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

    expect(html).toContain('Get started — connect your Google');
    expect(html).toContain('Try Demo');
    expect(html).not.toContain('Try Demo Mission');
  });
});
