// Live Mode is opt-in at build time. Without VITE_AGENTOS_API_URL (the public
// Demo deployment) nothing in src/live makes a request.
//   npm run dev:live   uses .env.live  ->  VITE_AGENTOS_API_URL=/api  (proxied to the backend)

const raw = (import.meta.env.VITE_AGENTOS_API_URL || '').trim();

export const LIVE_API_URL = raw ? raw.replace(/\/+$/, '') : null;
