import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, formatAuthError } from './api';
import { planMission } from '../agentos/planner';

const json = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

describe('backend API client', () => {
  it('refuses to call anything when no backend is configured', async () => {
    const fetchImpl = vi.fn();
    const api = createApiClient(null, { fetchImpl });
    await expect(api.health()).rejects.toMatchObject({ code: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts a planner plan as JSON to /missions', async () => {
    const fetchImpl = vi.fn(async () => json(201, { id: 'm1' }));
    const api = createApiClient('/api', { fetchImpl });
    const goal = 'Research our top 3 competitors';
    const plan = planMission(goal);
    await expect(api.createMission(goal, plan)).resolves.toEqual({ id: 'm1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/missions');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ goal, plan: JSON.parse(JSON.stringify(plan)) });
  });

  it('sends how the mission was requested only when given', async () => {
    const fetchImpl = vi.fn(async () => json(201, { id: 'm2' }));
    const api = createApiClient('/api', { fetchImpl });
    const goal = 'Plan my week around my deadlines';
    await api.createMission(goal, planMission(goal), { source: 'template', templateId: 'week-os' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ source: 'template', template_id: 'week-os' });
    await api.createMission(goal, planMission(goal));
    const plain = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect('source' in plain || 'template_id' in plain).toBe(false);
  });

  it('maps backend app fields to the names the Apps UI reads', async () => {
    const backendApp = {
      id: 'google-calendar', status: 'connected', account_email: 'me@example.com',
      granted_scopes: ['calendar.events'], disconnect_warning: 'Stops scheduling.', actions: [],
    };
    const fetchImpl = vi.fn(async () => json(200, [backendApp]));
    const [app] = await createApiClient('/api', { fetchImpl }).listApps();
    expect(app).toMatchObject({ accountEmail: 'me@example.com', grantedScopes: ['calendar.events'], disconnectWarning: 'Stops scheduling.', account_email: 'me@example.com' });
  });

  it('turns the server error shape into an ApiError with its code', async () => {
    const api = createApiClient('/api', {
      fetchImpl: async () => json(404, { error: { code: 'mission_not_found', message: 'Mission not found.', request_id: 'r1' } }),
    });
    const err = await api.getMission('x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'mission_not_found', message: 'Mission not found.', requestId: 'r1' });
  });

  it('treats a bare 5xx from a proxy as the backend being unavailable', async () => {
    const api = createApiClient('/api', { fetchImpl: async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json'); } }) });
    await expect(api.health()).rejects.toMatchObject({ code: 'backend_unavailable', message: 'The backend is not responding.' });
  });

  it('keeps the backend’s own 500 error code', async () => {
    const api = createApiClient('/api', { fetchImpl: async () => json(500, { error: { code: 'internal_error', message: 'Something went wrong.' } }) });
    await expect(api.health()).rejects.toMatchObject({ code: 'internal_error' });
  });

  it('reports network failures and timeouts distinctly', async () => {
    const down = createApiClient('/api', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
    await expect(down.health()).rejects.toMatchObject({ code: 'network_error' });

    const slow = createApiClient('/api', {
      timeoutMs: 20,
      fetchImpl: (_, { signal }) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
    });
    await expect(slow.health()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('encodes ids in paths', async () => {
    const fetchImpl = vi.fn(async () => json(200, []));
    const api = createApiClient('/api', { fetchImpl });
    await api.listEvents('a/b?c', 'nonsense');
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/missions/a%2Fb%3Fc/events?after=0');
  });

  it('handles app endpoints: list, update permissions, activity, and disconnect', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (url === '/api/apps' && (!init || init.method === 'GET')) return json(200, [{ id: 'google-calendar' }]);
      if (url === '/api/apps/google-calendar/permissions' && init?.method === 'PATCH') return json(200, { ok: true });
      if (url === '/api/apps/google-calendar/activity?limit=10') return json(200, [{ id: 'act-1' }]);
      if (url === '/api/apps/google-calendar' && init?.method === 'DELETE') return json(200, { disconnected: true });
      return json(404, {});
    });
    const api = createApiClient('/api', { fetchImpl });

    const apps = await api.listApps();
    expect(apps).toEqual([{ id: 'google-calendar' }]);

    const updateRes = await api.updateAppPermissions('google-calendar', { 'calendar.create_event': 'ask' });
    expect(updateRes).toEqual({ ok: true });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ actions: { 'calendar.create_event': 'ask' } });

    const activity = await api.getAppActivity('google-calendar', 10);
    expect(activity).toEqual([{ id: 'act-1' }]);

    const discRes = await api.disconnectApp('google-calendar');
    expect(discRes).toEqual({ disconnected: true });
    expect(fetchImpl.mock.calls[3][1].method).toBe('DELETE');
  });

  it('handles live mission execution, approvals, evidence and integrations', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (url === '/api/missions/m-123/start' && init?.method === 'POST') return json(200, { id: 'm-123', status: 'running' });
      if (url === '/api/approvals/appr-1' && (!init || init.method === 'GET')) return json(200, { id: 'appr-1', status: 'pending' });
      if (url === '/api/approvals/appr-1/decision' && init?.method === 'POST') {
        const body = JSON.parse(init.body);
        return json(200, { id: 'appr-1', status: body.decision });
      }
      if (url === '/api/missions/m-123/evidence' && (!init || init.method === 'GET')) return json(200, [{ id: 'ev-1', label: 'Event' }]);
      if (url === '/api/integrations' && (!init || init.method === 'GET')) return json(200, [{ provider: 'google', status: 'connected' }]);
      if (url === '/api/integrations/google/connect' && init?.method === 'POST') return json(200, { authorization_url: 'https://auth' });
      if (url === '/api/integrations/google' && init?.method === 'DELETE') return json(204, null);
      return json(404, {});
    });
    const api = createApiClient('/api', { fetchImpl });

    const started = await api.startMission('m-123');
    expect(started).toEqual({ id: 'm-123', status: 'running' });

    const appr = await api.getApproval('appr-1');
    expect(appr).toEqual({ id: 'appr-1', status: 'pending' });

    const decided = await api.decideApproval('appr-1', 'approve');
    expect(decided).toEqual({ id: 'appr-1', status: 'approve' });

    const evidence = await api.getMissionEvidence('m-123');
    expect(evidence).toEqual([{ id: 'ev-1', label: 'Event' }]);

    const integs = await api.listIntegrations();
    expect(integs).toEqual([{ provider: 'google', status: 'connected' }]);

    const conn = await api.connectGoogle();
    expect(conn).toEqual({ authorization_url: 'https://auth' });

    await api.disconnectGoogle();
    expect(fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1][1].method).toBe('DELETE');
  });

  it('includes credentials: include on all requests and CSRF header on mutating requests', async () => {
    const fetchImpl = vi.fn(async () => json(200, { ok: true }));
    const api = createApiClient('/api', { fetchImpl });

    await api.health();
    const [, getInit] = fetchImpl.mock.calls[0];
    expect(getInit.credentials).toBe('include');
    expect(getInit.headers['X-Requested-With']).toBeUndefined();

    await api.logout();
    const [, postInit] = fetchImpl.mock.calls[1];
    expect(postInit.credentials).toBe('include');
    expect(postInit.headers['X-Requested-With']).toBe('XMLHttpRequest');
  });

  it('handles auth endpoints and falls back gracefully', async () => {
    const user = { id: 'u1', email: 'test@example.com', name: 'Tester' };
    const fetchImpl = vi.fn(async (url, init) => {
      if (url === '/api/v1/auth/me') return json(200, { user });
      if (url === '/api/v1/auth/login') return json(200, { user });
      if (url === '/api/v1/auth/signup') return json(201, { user });
      if (url === '/api/v1/auth/logout') return json(204, null);
      return json(404, {});
    });
    const api = createApiClient('/api', { fetchImpl });

    const me = await api.getMe();
    expect(me).toEqual({ user });

    const loggedIn = await api.login({ email: 'test@example.com', password: 'secretpassword' });
    expect(loggedIn).toEqual({ user });

    const signedUp = await api.signup({ email: 'test@example.com', password: 'secretpassword', name: 'Tester' });
    expect(signedUp).toEqual({ user });

    await api.logout();
    expect(fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1][0]).toBe('/api/v1/auth/logout');
  });

  it('formats auth error codes into user-facing messages', () => {
    expect(formatAuthError(new ApiError(401, 'invalid_credentials', 'Bad login'))).toBe(
      'Invalid email or password. Please try again.'
    );
    expect(formatAuthError(new ApiError(400, 'email_taken', 'Email exists'))).toBe(
      'An account with this email address already exists.'
    );
    expect(formatAuthError(new ApiError(429, 'rate_limited', 'Too many requests'))).toBe(
      'Too many attempts. Please wait a moment and try again.'
    );
    expect(formatAuthError(new ApiError(0, 'network_error', 'Network fail'))).toBe(
      'Could not reach the server. Please check your connection.'
    );
    expect(formatAuthError(new ApiError(0, 'timeout', 'Timed out'))).toBe(
      'The backend did not respond in time. Please try again.'
    );
    expect(formatAuthError(new ApiError(0, 'not_configured', 'No backend'))).toBe(
      'The AgentOS backend is not configured.'
    );
    expect(formatAuthError(new Error('Custom error'))).toBe('Custom error');
    expect(formatAuthError(null)).toBeNull();
  });
});

