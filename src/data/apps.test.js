import { describe, expect, it } from 'vitest';
import { APPS_CATALOGUE, RISK_LEVELS, toConnectedStatus, getConnectedServicesStatus } from './apps';

describe('Apps catalogue specification and safety rules', () => {
  it('contains all required everyday apps', () => {
    const ids = APPS_CATALOGUE.map((a) => a.id);
    expect(ids).toContain('google-calendar');
    expect(ids).toContain('gmail');
    expect(ids).toContain('google-drive');
    expect(ids).toContain('google-forms');
    expect(ids).toContain('slack');
    expect(ids).toContain('whatsapp');
    expect(ids).toContain('notion');
    expect(ids).toContain('discord');
  });

  it('enforces demo catalogue honesty: no static entry is connected or has a non-null account', () => {
    for (const app of APPS_CATALOGUE) {
      // In Demo, apps must show 'demo' or 'coming_soon', never 'connected'
      expect(['demo', 'coming_soon']).toContain(app.status);
      expect(app.status).not.toBe('connected');
      // Account must be null (no invented emails or phone numbers)
      expect(app.accountEmail).toBeNull();
      // No granted scopes in the static catalogue
      expect(app.grantedScopes).toEqual([]);
    }
  });

  it('enforces safety invariant: HIGH and CRITICAL risk actions can NEVER be allowed by default', () => {
    for (const app of APPS_CATALOGUE) {
      for (const act of app.actions) {
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(act.risk);
        if (act.risk === 'HIGH' || act.risk === 'CRITICAL') {
          expect(act.defaultMode).not.toBe('allowed');
          expect(['ask', 'off']).toContain(act.defaultMode);
          expect(act.mode).not.toBe('allowed');
        }
      }
    }
  });

  it('defines allowedModes correctly in RISK_LEVELS', () => {
    expect(RISK_LEVELS.HIGH.allowedModes).not.toContain('allowed');
    expect(RISK_LEVELS.CRITICAL.allowedModes).not.toContain('allowed');
    expect(RISK_LEVELS.LOW.allowedModes).toContain('allowed');
    expect(RISK_LEVELS.MEDIUM.allowedModes).toContain('allowed');
  });

  describe('Connected Apps status derivation (#66)', () => {
    it('maps raw status to the 3 required states: Connected, Not connected, or Reconnect', () => {
      expect(toConnectedStatus('connected')).toBe('Connected');
      expect(toConnectedStatus('needs_reconnect')).toBe('Reconnect');
      expect(toConnectedStatus('available')).toBe('Not connected');
      expect(toConnectedStatus('demo')).toBe('Not connected');
      expect(toConnectedStatus('coming_soon')).toBe('Not connected');
      expect(toConnectedStatus(null)).toBe('Not connected');
      expect(toConnectedStatus(undefined)).toBe('Not connected');
    });

    it('derives Google, Gmail, Calendar, Drive, and Forms statuses from /api/integrations and /api/apps', () => {
      const integrations = [
        { provider: 'google', status: 'connected', scopes: ['calendar.events', 'gmail.compose'], account_email: 'alex@agentos.org' },
      ];
      const apps = [
        { id: 'gmail', status: 'connected' },
        { id: 'google-calendar', status: 'connected' },
        { id: 'google-drive', status: 'available' },
        { id: 'google-forms', status: 'available' },
      ];

      const statuses = getConnectedServicesStatus(integrations, apps);
      expect(statuses).toEqual({
        google: 'Connected',
        gmail: 'Connected',
        calendar: 'Connected',
        drive: 'Not connected',
        forms: 'Not connected',
      });
    });

    it('handles Reconnect status when credentials need refresh', () => {
      const integrations = [
        { provider: 'google', status: 'needs_reconnect', scopes: [], account_email: 'alex@agentos.org' },
      ];
      const apps = [
        { id: 'gmail', status: 'needs_reconnect' },
        { id: 'google-calendar', status: 'needs_reconnect' },
        { id: 'google-drive', status: 'needs_reconnect' },
        { id: 'google-forms', status: 'needs_reconnect' },
      ];

      const statuses = getConnectedServicesStatus(integrations, apps);
      expect(statuses).toEqual({
        google: 'Reconnect',
        gmail: 'Reconnect',
        calendar: 'Reconnect',
        drive: 'Reconnect',
        forms: 'Reconnect',
      });
    });

    it('returns Not connected for all services when empty or disconnected', () => {
      const statuses = getConnectedServicesStatus([], []);
      expect(statuses).toEqual({
        google: 'Not connected',
        gmail: 'Not connected',
        calendar: 'Not connected',
        drive: 'Not connected',
        forms: 'Not connected',
      });
    });
  });
});
