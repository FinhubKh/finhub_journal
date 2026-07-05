# nXuu Trading Journal — React

React 19 + Vite port of the original vanilla JS app. Same Supabase backend, same schema, same CSS/design.

## Run
```bash
npm install
npm run dev
```

## Structure
- `src/lib/auth.js` — Supabase auth (session singleton + pub/sub)
- `src/lib/api.js` — trades/steps/models/sync-key/leaderboard REST calls
- `src/lib/effects.js` — checklist audio + confetti
- `src/lib/stats.js` — stats/streaks calculations
- `src/context/` — AuthContext, AppDataContext, TradeModalContext
- `src/components/` — AuthScreen, TabBar, TradeModal
- `src/components/tabs/` — Overview, Log, Calendar, Leaderboard, Settings

Supabase URL/anon key are in `src/lib/auth.js` (same project as before). Schema/SQL files, the MT5 EA, and the sync-trades Edge Function from the original repo are unchanged and still apply.

## Build
```bash
npm run build
```
