# Master / EA Risk Eligibility — Design Spec

**Date:** 2026-09-15  
**Status:** Approved for planning  
**Product:** Finhub Journal

## Summary

Automatically decide whether a trading account is eligible for **Master** or **EA Safe** status from journal trade data. This is not a self-checklist. Status is live: if measurable rules break, eligibility and any public badge drop immediately.

## Goals

- Per-account risk track: `master` or `ea`
- Server-side eligibility engine using journal metrics only
- Private pass/fail checklist with actual vs limit
- Public badge on share / leaderboard when `is_public && risk_eligible`
- Capital protection first — profit second

## Non-goals (v1)

- Self-attestation (disclosures, conflict of interest, guaranteed-profit bans)
- EA operational controls (kill switch, news filter, martingale, stress test, grid caps)
- Admin review workflow
- Grace period or sticky “earned on” badges
- Blocking publish until eligible
- Portfolio-level Master status

## Architecture

1. Account stores `risk_track` (`null` | `master` | `ea`).
2. After trade sync, trade edit/delete, or track change → refresh eligibility.
3. SQL/RPC (or shared refresh hooked from existing `refresh_account_trade_stats`) computes measurable rules.
4. Results written to `trading_accounts`: `risk_eligible`, `risk_failed_rules`, `risk_metrics`, `risk_checked_at`.
5. Private UI reads those fields.
6. Public share / leaderboard expose badge only when published and currently eligible.

## Data model

Extend `trading_accounts`:

| Column | Type | Notes |
|--------|------|--------|
| `risk_track` | `text` null | `master` \| `ea` \| null |
| `risk_eligible` | `boolean` not null default false | Live pass/fail |
| `risk_failed_rules` | `jsonb` default `[]` | Array of rule ids that failed |
| `risk_metrics` | `jsonb` default `{}` | Snapshot of actual values used |
| `risk_checked_at` | `timestamptz` null | Last compute time |

Check constraint: `risk_track is null or risk_track in ('master','ea')`.

### Equity base

1. Prefer `starting_balance` when present and &gt; 0  
2. Else peak equity from the account equity curve  
3. Else mark ineligible with failed rule `equity_base_missing`

Cent accounts: compute in the account’s PnL denomination (same as journal display math).

## Measurable rules (v1)

### Shared (Master + EA)

| Id | Rule | Pass when |
|----|------|-----------|
| `history_6m` | Trading history ≥ 6 months | Days between first and last closed trade ≥ 182 |
| `daily_loss_1pct` | Max daily loss ≤ 1% | `abs(min(daily_pnl)) / equity_base ≤ 0.01` |
| `overall_loss_10pct` | Max overall loss ≤ 10% | Worst cumulative loss from start / equity_base ≤ 0.10 |
| `max_dd_10pct` | Max drawdown ≤ 10% | Existing journal `max_dd` / equity_base ≤ 0.10 |
| `risk_per_trade_1pct` | Risk per trade ≤ 1% | Every trade’s risk / equity_base ≤ 0.01 |

**Risk per trade definition:**  
If trade has usable `r_value`, risk ≈ `|r_value| × avg_loss` (avg loss from account losers). Else for losing trades use `|pnl|`. Winning trades without R do not fail this rule. Any single exceedance fails the account.

### Master-only

| Id | Rule | Pass when |
|----|------|-----------|
| `losing_streak_3` | Losing streak control | No streak of 3+ consecutive losing trades in closed history |

### EA-only

| Id | Rule | Pass when |
|----|------|-----------|
| `perf_report_ready` | Performance report fields available | Journal can derive profit, loss, drawdown, worst month, and trade count (true once history + stats exist) |

Skipped from the original regulatory list in v1 (cannot be proven from journal alone): leverage, max open positions, max exposure, grid/martingale caps, SL/exit logic, kill switch, news protection, broker/server fail protection, stress test, disclosures, conflict of interest, guaranteed-profit ban.

## Eligibility states

| State | Condition | UI |
|-------|-----------|-----|
| Unconfigured | `risk_track` is null | Prompt to choose Master or EA; no badge |
| Needs history | Track set but `history_6m` fails | Show progress (e.g. 3.2 / 6 months) |
| Eligible | Track set and all track rules pass | Green Eligible + public badge if published |
| Not eligible | Track set and any rule fails | List failed rules with actual vs limit |

Live updates: recompute drops eligibility immediately when a rule fails.

## UI

### Account detail
- Risk track selector: Master / EA
- Status pill: Eligible / Not eligible / Needs history / Choose track
- Checklist: each measurable rule with actual, limit, pass/fail
- Short note: “Auto-checked from journal history. Operational EA controls are not verified in v1.”

### Overview (single-account view only)
- Compact pill beside Sync (e.g. `Master · Eligible` or `EA · 2 failing`)
- Click navigates to account detail checklist
- Portfolio view: no combined Master status

### Public share / leaderboard
- Badge label: **Master** or **EA Safe**
- Shown only if `is_public && risk_eligible && risk_track is not null`
- Hidden immediately when eligibility fails

## Refresh triggers

- After investor / EA sync writes trades
- After manual trade create / update / delete
- After `risk_track` change
- Optionally include in `refresh_account_trade_stats` so share/leaderboard stay consistent

## API / RPC

- Extend account update to accept `risk_track`
- `refresh_account_risk_eligibility(account_id)` (or fold into existing stats refresh)
- Journal bundle / account fetch includes risk fields
- Published account RPC includes `risk_track` + `risk_eligible` for badge (not full failed-rule dump unless useful)

## Error handling

- Missing equity base → not eligible + `equity_base_missing`
- Zero trades → not eligible + `history_6m` (and needs history copy)
- Partial stats failure → keep previous `risk_*` snapshot; log/toast soft error; do not silently mark eligible

## Testing

- Unit tests for rule math (history days, daily loss %, DD %, risk/trade, streak)
- Fixture accounts: eligible Master, failing DD, short history, EA eligible, unconfigured
- Public badge visibility: published+eligible shows; published+ineligible hides

## Success criteria

- Owner can set Master or EA on an account
- Status reflects journal metrics without manual checkboxes
- Failed rules show concrete actual vs limit
- Public badge appears only when eligible and published, and disappears when rules break
