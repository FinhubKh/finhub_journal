# FinhubKH Journal

Trading journal for MT4/MT5 traders. React 19 + Vite frontend, Supabase for auth and data, Vercel serverless functions for the API.

## Run
```bash
cp .env.example .env   # fill in Supabase + API keys
npm install
npm run dev            # Vite dev server (AI and bridge APIs are served by Vite plugins)
npm run api:dev        # optional: standalone local API server on :8787
```

## Scripts
- `npm test` — Vitest unit tests
- `npm run lint` — oxlint
- `npm run build` — production build to `dist/`
- `npm run db:check` — verify database tables exist
- `npm run functions:deploy` — deploy Supabase edge functions
- `npm run ea:config` / `npm run ea:compile` — regenerate the MT5 EA config

## Structure
- `src/pages/` — routed pages (dashboard, journal, calendar, backtests, compounding, leaderboard, admin, public share)
- `src/components/` — UI grouped by feature
- `src/api/` — Supabase REST and backend API clients
- `src/lib/` — pure logic (stats, formatting, SIAC eligibility, MT5 report parsing) with colocated tests
- `src/context/` — auth, app data, theme, dialogs, trade modal
- `api/` — Vercel serverless entry points (EA sync, MT5 bridge, AI advisor)
- `backend/api/` — request handlers shared by `api/`, the Vite dev plugins, and `npm run api:dev`
- `backend/migrations/` — dated SQL migrations
- `backend/ea/` — MT4/MT5 Expert Advisors
- `supabase/functions/` — Supabase edge functions (`sync-trades`, `embed`)
