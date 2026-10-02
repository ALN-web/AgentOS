# Deploying AgentOS (free): Vercel + Render + Neon

One public link. Visitors can use Demo Mode without an account, or sign up, connect
their own Google account and run real missions.

```
Browser ──► https://<app>.vercel.app          (website, Vercel)
              └── /api/*  ──rewrite──►  https://agentos-backend-qa0p.onrender.com/api/*   (backend, Render)
                                              └── Postgres (Neon)
```

Because Vercel forwards `/api`, the site and the API share one address, so the
login cookie and the Google sign-in work without cross-site problems.

Cost: $0. Never paste secrets into chat, issues, commits or screenshots.

## 1. Database: Neon (5 minutes)
1. Sign up at https://neon.tech with GitHub.
2. Create a project `agentos` (any region close to you, e.g. Singapore or Mumbai).
3. Copy the **connection string** (`postgresql://…?sslmode=require`). Keep it for step 2.

## 2. Backend: Render (10 minutes)
1. Make a **new** encryption key for production (do not reuse your local one):
   `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
2. Sign up at https://render.com with GitHub, then **New → Blueprint**, pick the
   `ALN-web/AgentOS` repository. Render reads `render.yaml`.
3. Fill in the secret values it asks for:

   | Key | Value |
   |---|---|
   | `AGENTOS_DATABASE_URL` | the Neon connection string |
   | `AGENTOS_ENCRYPTION_KEY` | the new key from step 1 |
   | `AGENTOS_GOOGLE_CLIENT_ID` / `_SECRET` | from Google Cloud → Clients |
   | `AGENTOS_GOOGLE_REDIRECT_URI` | `https://<app>.vercel.app/api/integrations/google/callback` |
   | `AGENTOS_FRONTEND_URL` | `https://<app>.vercel.app` |
   | `AGENTOS_LLM_API_KEY` | your Gemini key |
   | `AGENTOS_LLM_FALLBACK_API_KEY` | optional: a free Groq key (console.groq.com → API Keys) |

   The two public addresses (`AGENTOS_FRONTEND_URL`, `AGENTOS_GOOGLE_REDIRECT_URI`) are set in `render.yaml`; change them there if the Vercel address changes. Current site: https://agent-os-two-iota.vercel.app
4. Deploy. Done when `https://<service>.onrender.com/api/health` shows `"database":"ok"`.
   The first deploy runs every database migration on Neon.

## 3. Website: Vercel (5 minutes)
1. Open the project in Vercel (or **Add New → Project** → import `ALN-web/AgentOS`).
2. **Settings → Environment Variables:** `VITE_AGENTOS_API_URL` = `/api` (Production).
3. If the Render address is not `agentos-backend-qa0p.onrender.com`, change it in
   `vercel.json` (the `/api/:path*` rewrite) and merge.
4. Redeploy. Done when `https://<app>.vercel.app/api/health` returns the backend's JSON.

## 4. Google Cloud (10 minutes)
1. **Clients → AgentOS local** (or a new Web client): add the redirect URI
   `https://<app>.vercel.app/api/integrations/google/callback`.
2. **Branding → Authorised domains:** add `<app>.vercel.app`.
3. **Audience:** while testing, only listed test users can connect Google. To let
   anyone connect (up to 100 users before Google verification), **Publish app**.
   Restricted scopes (`gmail.compose`) block non-test users of an unverified app;
   see the Gmail note in the roadmap.

## 5. Test like a judge
Private window → the Vercel link → Sign up → Apps → Connect Google → New mission
(Live Mode) → approve → check the real event and email. Also: Demo Mode without
signing in, refresh mid-mission, log out and in.

## 6. Keep it awake during judging (free)
Render's free plan sleeps after 15 idle minutes (first request then takes ~30–60 s).
At https://cron-job.org add `GET https://<service>.onrender.com/api/health` every
10 minutes, only for the judging days.

## Notes
- Every merge to `main` redeploys both the website and the backend.
- Render's free disk is wiped on restart: all data lives in Neon.
- Free Gemini models have daily quotas; the planner falls back through
  `AGENTOS_LLM_FALLBACK_MODELS`, then to the second provider (Groq, if
  `AGENTOS_LLM_FALLBACK_API_KEY` is set), then to the rule-based planner.
