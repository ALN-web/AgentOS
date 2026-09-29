// Client for the AgentOS backend. Errors always arrive as ApiError with the
// server's stable error code, so the UI can react without parsing messages.

import { LIVE_API_URL } from './config';

export class ApiError extends Error {
  constructor(status, code, message, requestId = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

// The backend speaks snake_case; the Apps UI reads camelCase. Keep both.
const toUiApp = (a) =>
  a && typeof a === 'object'
    ? {
        ...a,
        accountEmail: a.accountEmail ?? a.account_email ?? undefined,
        grantedScopes: a.grantedScopes ?? a.granted_scopes ?? undefined,
        disconnectWarning: a.disconnectWarning ?? a.disconnect_warning ?? undefined,
      }
    : a;

export function createApiClient(baseUrl, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  async function request(path, { method = 'GET', body } = {}) {
    if (!baseUrl) throw new ApiError(0, 'not_configured', 'The AgentOS backend is not configured.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const e = data?.error;
        // A 5xx without our error shape came from a proxy or gateway, not the backend.
        if (!e && res.status >= 500) throw new ApiError(res.status, 'backend_unavailable', 'The backend is not responding.');
        throw new ApiError(res.status, e?.code || 'http_error', e?.message || `Request failed (${res.status}).`, e?.request_id || null);
      }
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err?.name === 'AbortError') throw new ApiError(0, 'timeout', 'The backend did not respond in time.');
      throw new ApiError(0, 'network_error', 'Could not reach the backend.');
    } finally {
      clearTimeout(timer);
    }
  }

  const id = (v) => encodeURIComponent(v);
  return {
    health: () => request('/health'),
    // source: 'typed' | 'voice' | 'template' (templateId required for 'template').
    createMission: (goal, plan, { source, templateId } = {}) =>
      request('/missions', {
        method: 'POST',
        body: { goal, plan, ...(source ? { source } : {}), ...(templateId ? { template_id: templateId } : {}) },
      }),
    listCapabilities: () => request('/capabilities'),
    listMissions: () => request('/missions'),
    getMission: (missionId) => request(`/missions/${id(missionId)}`),
    listEvents: (missionId, after = 0) => request(`/missions/${id(missionId)}/events?after=${Number(after) || 0}`),
    getPreferences: () => request('/preferences'),
    updatePreferences: (preferences) => request('/preferences', { method: 'PUT', body: preferences }),
    listApps: () => request('/apps').then((list) => (Array.isArray(list) ? list.map(toUiApp) : list)),
    updateAppPermissions: (appId, actions) =>
      request(`/apps/${id(appId)}/permissions`, {
        method: 'PATCH',
        body: { actions },
      }).then(toUiApp),
    getAppActivity: (appId, limit = 20) => request(`/apps/${id(appId)}/activity?limit=${Number(limit) || 20}`),
    disconnectApp: (appId) => request(`/apps/${id(appId)}`, { method: 'DELETE' }),
  };
}

export const api = createApiClient(LIVE_API_URL);
