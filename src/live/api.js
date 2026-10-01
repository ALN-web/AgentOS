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
  async function request(path, { method = 'GET', body, timeoutMs: customTimeout } = {}) {
    if (!baseUrl) throw new ApiError(0, 'not_configured', 'The AgentOS backend is not configured.');
    const controller = new AbortController();
    const effectiveTimeout = customTimeout ?? timeoutMs;
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);
    try {
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
      const res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(isWrite ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
        },
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
    // Auth endpoints (fallback between /v1/auth and /auth)
    getMe: () =>
      request('/v1/auth/me').catch((err) =>
        err.status === 404 ? request('/auth/me') : Promise.reject(err)
      ),
    signup: (credentials) =>
      request('/v1/auth/signup', { method: 'POST', body: credentials }).catch((err) =>
        err.status === 404 ? request('/auth/signup', { method: 'POST', body: credentials }) : Promise.reject(err)
      ),
    login: (credentials) =>
      request('/v1/auth/login', { method: 'POST', body: credentials }).catch((err) =>
        err.status === 404 ? request('/auth/login', { method: 'POST', body: credentials }) : Promise.reject(err)
      ),
    logout: () =>
      request('/v1/auth/logout', { method: 'POST' }).catch((err) =>
        err.status === 404 ? request('/auth/logout', { method: 'POST' }) : Promise.reject(err)
      ),
    // source: 'typed' | 'voice' | 'template' (templateId required for 'template').
    createMission: (goal, plan, { source, templateId } = {}) =>
      request('/missions', {
        method: 'POST',
        body: { goal, plan, ...(source ? { source } : {}), ...(templateId ? { template_id: templateId } : {}) },
      }),
    analyzeMission: (goal, answers = {}) =>
      request('/missions/analyze', {
        method: 'POST',
        body: { goal, answers },
        timeoutMs: 60000,
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
    startMission: (missionId) => request(`/missions/${id(missionId)}/start`, { method: 'POST' }),
    listApprovals: (status = 'pending') => request(`/v1/approvals?status=${status}`).catch((err) =>
      err.status === 404 ? request(`/approvals?status=${status}`) : Promise.reject(err)
    ),
    getApproval: (approvalId) => request(`/v1/approvals/${id(approvalId)}`).catch((err) =>
      err.status === 404 ? request(`/approvals/${id(approvalId)}`) : Promise.reject(err)
    ),
    decideApproval: (approvalId, decision, edits = null) =>
      request(`/v1/approvals/${id(approvalId)}/decision`, {
        method: 'POST',
        body: { decision, input: 'click', ...(edits ? { edits } : {}) },
      }).catch((err) =>
        err.status === 404
          ? request(`/approvals/${id(approvalId)}/decision`, {
              method: 'POST',
              body: { decision, input: 'click', ...(edits ? { edits } : {}) },
            })
          : Promise.reject(err)
      ),
    getMissionEvidence: (missionId) => request(`/missions/${id(missionId)}/evidence`),
    getMissionProof: (missionId) => request(`/missions/${id(missionId)}/proof`),
    verifyMission: (missionId) => request(`/missions/${id(missionId)}/verify`, { method: 'POST' }),
    listIntegrations: () => request('/integrations'),
    connectGoogle: (apps) =>
      request('/integrations/google/connect', {
        method: 'POST',
        body: apps && apps.length > 0 ? { apps } : undefined,
      }),
    disconnectGoogle: () => request('/integrations/google', { method: 'DELETE' }),
  };
}

export function formatAuthError(error) {
  if (!error) return null;
  const status = error?.status;
  const code = error?.code || (error instanceof ApiError ? error.code : null);
  const msg = (error?.message || '').toLowerCase();

  // 401: Wrong email or password
  if (
    status === 401 ||
    code === 'invalid_credentials' ||
    code === 'unauthorized' ||
    msg.includes('unauthorized') ||
    msg.includes('invalid credentials') ||
    msg.includes('wrong password') ||
    msg.includes('wrong email or password')
  ) {
    return 'Wrong email or password';
  }

  // 404: Endpoint not found / backend not responding with auth route yet -> "Couldn't reach the server"
  if (
    status === 404 ||
    code === 'not_found' ||
    msg.includes('not found') ||
    msg.includes('404')
  ) {
    return "Couldn't reach the server";
  }

  // Network failures / timeouts / server down
  if (
    status === 0 ||
    code === 'network_error' ||
    code === 'timeout' ||
    code === 'backend_unavailable' ||
    code === 'not_configured' ||
    (typeof status === 'number' && status >= 500 && status < 600)
  ) {
    return "Couldn't reach the server";
  }

  if (code === 'email_taken' || (msg.includes('email') && msg.includes('exists'))) {
    return 'An account with this email address already exists.';
  }

  if (code === 'rate_limited') {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return error.message || "Couldn't reach the server";
}

export const api = createApiClient(LIVE_API_URL);
