import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';
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
});

