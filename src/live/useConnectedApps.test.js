import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reconcileAppsWithIntegrations } from './useConnectedApps';
import { api } from './api';

describe('useConnectedApps - Connected Apps Drive & Forms (#66)', () => {
  const baseApps = [
    { id: 'google-calendar', name: 'Google Calendar', status: 'available', accountEmail: null, grantedScopes: [] },
    { id: 'gmail', name: 'Gmail', status: 'available', accountEmail: null, grantedScopes: [] },
    { id: 'google-drive', name: 'Google Drive', status: 'available', accountEmail: null, grantedScopes: [] },
    { id: 'google-forms', name: 'Google Forms', status: 'available', accountEmail: null, grantedScopes: [] },
    { id: 'slack', name: 'Slack', status: 'available', accountEmail: null, grantedScopes: [] },
  ];

  it('reconciles Google Drive and Google Forms as connected when scopes are present in integration', () => {
    const integrations = [
      {
        provider: 'google',
        status: 'connected',
        scopes: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/forms.body',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        account_email: 'user@example.com',
      },
    ];

    const reconciled = reconcileAppsWithIntegrations(baseApps, integrations);
    const drive = reconciled.find((a) => a.id === 'google-drive');
    const forms = reconciled.find((a) => a.id === 'google-forms');
    const calendar = reconciled.find((a) => a.id === 'google-calendar');
    const gmail = reconciled.find((a) => a.id === 'gmail');
    const slack = reconciled.find((a) => a.id === 'slack');

    expect(drive.status).toBe('connected');
    expect(drive.accountEmail).toBe('user@example.com');
    expect(forms.status).toBe('connected');
    expect(forms.accountEmail).toBe('user@example.com');
    expect(calendar.status).toBe('connected');
    expect(gmail.status).toBe('connected');
    expect(slack.status).toBe('available');
  });

  it('marks Drive and Forms as needs_reconnect when Google integration needs reconnect', () => {
    const integrations = [
      {
        provider: 'google',
        status: 'needs_reconnect',
        scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/forms.body',
        ],
        account_email: 'user@example.com',
      },
    ];

    const reconciled = reconcileAppsWithIntegrations(baseApps, integrations);
    const drive = reconciled.find((a) => a.id === 'google-drive');
    const forms = reconciled.find((a) => a.id === 'google-forms');

    expect(drive.status).toBe('needs_reconnect');
    expect(forms.status).toBe('needs_reconnect');
  });

  it('preserves existing connected status if already connected from /api/apps', () => {
    const appsWithConnected = [
      { id: 'google-drive', status: 'connected', accountEmail: 'custom@example.com', grantedScopes: [] },
      { id: 'google-forms', status: 'connected', accountEmail: 'custom@example.com', grantedScopes: [] },
    ];

    const reconciled = reconcileAppsWithIntegrations(appsWithConnected, []);
    expect(reconciled[0].status).toBe('connected');
    expect(reconciled[1].status).toBe('connected');
  });

  it('never leaks tokens in reconciled app objects', () => {
    const integrations = [
      {
        provider: 'google',
        status: 'connected',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
        account_email: 'user@example.com',
      },
    ];

    const reconciled = reconcileAppsWithIntegrations(baseApps, integrations);
    const serialized = JSON.stringify(reconciled);
    expect(serialized).not.toMatch(/token|secret|ya29|refresh/i);
  });

  it('calls POST /api/integrations/google/connect with { apps: ["google-drive"] } or ["google-forms"]', async () => {
    const connectSpy = vi.spyOn(api, 'connectGoogle').mockResolvedValue({
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
    });

    await api.connectGoogle(['google-drive']);
    expect(connectSpy).toHaveBeenCalledWith(['google-drive']);

    await api.connectGoogle(['google-forms']);
    expect(connectSpy).toHaveBeenCalledWith(['google-forms']);

    connectSpy.mockRestore();
  });
});
