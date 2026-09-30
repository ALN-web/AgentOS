import { describe, expect, it } from 'vitest';
import { APPS_CATALOGUE, RISK_LEVELS } from './apps';

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
});
