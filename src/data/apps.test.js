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

  it('assigns only valid, honest statuses', () => {
    const validStatuses = new Set(['connected', 'available', 'demo', 'coming_soon']);
    for (const app of APPS_CATALOGUE) {
      expect(validStatuses.has(app.status)).toBe(true);
      if (app.status === 'connected') {
        expect(app.accountEmail).toBeTruthy();
        expect(app.disconnectWarning).toBeTruthy();
      }
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
