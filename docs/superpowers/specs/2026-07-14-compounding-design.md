# Compounding Growth — Design Spec

**Date:** 2026-07-14  
**Status:** Approved for planning  
**Product:** FinHubKH Journal  
**Reference:** `myPlan` compounding feature (`~/Desktop/Project/myPlan/src/features/compounding`)

## Goal

Port the myPlan compounding experience into FinHub Journal as a first-class dashboard tab: users create a compounding plan (capital → target balance, profit % per win, risk %), get a trade-by-trade compound spreadsheet, log wins/losses, and use P&L calendar, analytics, lot sizing, and export — adapted to Supabase and existing journal UI patterns.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Approach | Port myPlan logic into journal stack (not Firebase/Next copy, not journal-PnL auto-advance) |
| Placement | New dashboard tab: **Compound** |
| Account model | Standalone plans **or** optional link to an existing `trading_accounts` row |
| Progress source | Compounding trade log only (not MT5/journal trades) |
| Win growth | `target_profit_percent` of current balance per win; `risk_percent` for risk $ / lot sizing |
| Scope | Full myPlan feature set: spreadsheet, calendar PnL, analytics, lot sizing, export |

## Out of scope

- Auto-importing or matching journal/MT5 closed trades into compound steps
- Firebase / Next.js routing from myPlan
- Changing Overview equity chart to use compound plans
- Multi-currency compounding beyond the account’s existing denomination assumptions

## Architecture

```
Dashboard tab "compound"
  ├─ List: CompoundingPage (accounts CRUD)
  └─ Detail: CompoundingAccountPage (sub-views)
       ├─ Plan (spreadsheet + log W/L/BE)
       ├─ P&L calendar
       ├─ Analytics
       └─ Settings / edit + export

API (src/api) → Supabase PostgREST
  ├─ compounding_accounts
  └─ compounding_trades

Lib (ported/adapted from myPlan → journal JS)
  ├─ calculations.js  (risk, target profit, lots, rebuildTradeChain, stats)
  ├─ projection.js    (spreadsheet rows, trades-to-goal)
  ├─ calendarPnL.js
  ├─ analytics.js / milestones.js / export.js
  └─ account.js / formatMoney.js
```

- Shell: same as Overview/Log — tab state in `DashboardPage` + `TabBar`, not a new React Router route.
- Detail navigation: in-tab selected account id (component state or URL hash/query if already used elsewhere; default component state).
- Auth/RLS: same as other user tables (`auth.uid() = user_id`).

## Data model

### `compounding_accounts`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | `gen_random_uuid()` |
| user_id | uuid FK → auth.users | cascade delete |
| name | text | required |
| starting_balance | numeric | > 0 |
| target_balance | numeric | > starting_balance |
| target_profit_percent | numeric | profit per win as % of current balance |
| risk_percent | numeric | risk per trade as % of balance |
| risk_reward_ratio | numeric | optional; default like myPlan (e.g. 3) |
| stop_loss_pips | numeric | nullable |
| stop_loss_points | numeric | nullable |
| lot_size_method | text | `fixed_risk_pips` \| `fixed_risk_points` \| `percent_of_balance` |
| pip_value_per_lot | numeric | default 10 |
| point_value_per_lot | numeric | default 1 |
| pl_source | text | `calculated` \| `calendar` |
| trading_account_id | uuid FK → trading_accounts | **nullable**; `on delete set null` |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | nullable / trigger optional |

Indexes: `(user_id)`, `(user_id, created_at desc)`, `(trading_account_id)`.  
RLS: select/insert/update/delete where `auth.uid() = user_id`.

### `compounding_trades`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| user_id | uuid FK | cascade |
| compounding_account_id | uuid FK → compounding_accounts | cascade delete |
| trade_number | int | display order; rebuild may renumber |
| date | date | logging day (ISO date) |
| result | text | `win` \| `loss` \| `breakeven` |
| actual_pl | numeric | stored when manual or needed for rebuild |
| use_manual_pl | boolean | default false |
| notes | text | default '' |
| calendar_trades | int | nullable |
| calendar_win_trades | int | nullable |
| calendar_loss_trades | int | nullable |
| created_at / updated_at | timestamptz | |

Indexes: `(compounding_account_id)`, `(user_id, compounding_account_id)`.  
RLS: same ownership pattern; inserts must match owning user and account.

**Computed (not stored):** balanceBefore, balanceAfter, riskAmount, targetProfit, suggestedLotSize — via `rebuildTradeChain(config, trades)`.

Ship as `backend/schema_compounding.sql` following existing schema_* conventions.

## UI / UX

### Tab

Add **Compound** to `TabBar` / dashboard tab map alongside Overview, Log, Calendar, Checklist, Settings.

### List view

- Header + “New plan”
- Cards/rows: name, start → target, profit %/win, risk %, optional linked trading account name, progress summary if trades exist
- Actions: open, edit, delete (confirm dialog)

### Create / edit

Modal fields (create): name, starting capital, target balance, profit % per win, risk %, optional trading account dropdown (from user’s `trading_accounts`).  
Edit/Settings: also lot method, SL pips/points, pip/point values, RR, pl_source.

Validation: finite numbers; start > 0; target > start; `0 < target_profit_percent ≤ 100`; `0 < risk_percent ≤ 100`.

### Detail view

Sub-tabs:

1. **Plan** — progress summary, trades-to-goal, compound spreadsheet; date picker for logging; Win / Loss / BE on current row; edit past results
2. **P&L calendar** — day aggregates from compounding trades
3. **Analytics** — win rate, streaks, drawdown, PF, EV, gauges as in myPlan (styled to journal)
4. **Settings** — account config + export (CSV/download as myPlan)

Visual language: journal existing components (`btnPrimary`, `btnGhost`, modals, dropdowns) — not a verbatim glass dark theme from myPlan.

## Behavior

### Spreadsheet rows

- Completed: from logged trades  
- Current + pending projections: next N rows assuming consecutive wins until target (cap loops at ~500)  
- Columns: trade #, date (when calendar mode), balance before, profit needed (%), risk amount, after win, after loss, lots, status/result

### Logging

- Selecting Win/Loss/BE **appends** a new compounding trade (with the selected log date); editing a past row updates that trade’s `result` / manual PL  
- PL derived from target profit / risk unless `use_manual_pl`  
- Calendar aggregates those trades by date for display and optional `pl_source = calendar` behavior

### Optional trading account link

- Metadata and optional seed of starting balance / labeling only  
- Never auto-advances plan from journal trades

### Error handling

- Toast on validation/API failure  
- Disable submit while saving  
- Delete account cascades trades  
- Broken optional FK: `on delete set null` on trading_account_id

## File / module plan (implementation sketch)

| Area | Location |
|------|----------|
| Schema | `backend/schema_compounding.sql` |
| API CRUD | `src/api/index.js` (or dedicated `src/api/compounding.js` exported from index) |
| Lib | `src/lib/compounding/*` (ported helpers) |
| Pages | `src/pages/CompoundingPage.jsx` (+ detail as page section or `CompoundingAccountView.jsx`) |
| Components | `src/components/compounding/*` |
| Tab wiring | `TabBar.jsx`, `DashboardPage.jsx` |
| Data context | Prefer local hooks for compound detail; list refresh via fetch after mutations (same pattern as Settings accounts) |

## Testing / verification

- Unit: `rebuildTradeChain`, `buildSpreadsheetRows`, `tradesNeededToTarget`, risk/profit/lot helpers  
- Manual checklist: create standalone plan; create linked plan; log W/L/BE; edit settings and see chain rebuild; calendar; analytics; export; delete; RLS isolation (second user cannot see rows)

## Success criteria

- User can create a compounding plan with capital, target balance, profit %/win, and risk %  
- Spreadsheet generates correct compound steps and projections  
- User can log results and see live balance/progress toward target  
- P&L calendar, analytics, lot sizing, and export work as in myPlan intent  
- Optional link to a trading account works without coupling to journal trade sync  
- UI lives under the Compound dashboard tab and matches journal patterns
