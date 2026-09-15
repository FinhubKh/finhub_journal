# Master / EA Risk Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically mark each trading account Eligible / Not eligible for Master or EA Safe from journal metrics, show a private checklist, and show a live public badge when published.

**Architecture:** Pure JS rule engine (unit-tested) mirrors a Postgres `refresh_account_risk_eligibility` function that persists results on `trading_accounts`. UI and public share read persisted fields. Status is live — recompute after trades change or `risk_track` updates.

**Tech Stack:** Vite/React journal, Vitest, Supabase Postgres SQL migrations, existing `trading_accounts` / `trades` / `account_daily_stats` tables.

**Spec:** `docs/specs/2026-09-15-master-trader-eligibility-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/riskEligibility.js` | Pure rule math + evaluate helpers |
| `src/lib/riskEligibility.test.js` | Unit tests for rules |
| `src/lib/accounts.js` | `RISK_TRACKS`, normalize/label helpers |
| `backend/migrations/2026-09-15_account_risk_eligibility.sql` | Columns + SQL refresh + hook into trade-stats refresh + publish RPC fields |
| `src/api/index.js` | Select new columns; optional RPC wrapper |
| `src/components/settings/RiskEligibilityPanel.jsx` | Track picker + checklist UI |
| `src/pages/AccountDetailPage.jsx` | Mount panel |
| `src/components/common/RiskStatusPill.jsx` | Compact overview pill |
| `src/pages/OverviewPage.jsx` | Show pill in single-account view |
| `src/pages/PublicSharePage.jsx` | Master / EA Safe badge |
| `src/api/share.js` | Map badge fields from published RPC |

---

### Task 1: Pure JS eligibility engine + failing tests

**Files:**
- Create: `src/lib/riskEligibility.js`
- Create: `src/lib/riskEligibility.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/lib/riskEligibility.test.js
import { describe, expect, it } from 'vitest';
import {
  equityBase,
  historyDays,
  maxDailyLossPct,
  maxOverallLossPct,
  maxDrawdownPct,
  riskPerTradeBreaches,
  hasLosingStreakOf,
  evaluateRiskEligibility,
} from './riskEligibility.js';

const day = (offset, pnl, result = pnl >= 0 ? 'win' : 'loss') => ({
  date: `2025-01-${String(1 + offset).padStart(2, '0')}`,
  pnl_usd: pnl,
  result,
  r_value: 0,
});

describe('equityBase', () => {
  it('prefers starting_balance', () => {
    expect(equityBase({ starting_balance: 10000 }, 500)).toBe(10000);
  });
  it('falls back to peak equity', () => {
    expect(equityBase({ starting_balance: 0 }, 2500)).toBe(2500);
  });
});

describe('historyDays', () => {
  it('counts inclusive span between first and last trade', () => {
    const trades = [day(0, 10), day(181, -5)];
    expect(historyDays(trades)).toBeGreaterThanOrEqual(182);
  });
});

describe('evaluateRiskEligibility', () => {
  it('returns unconfigured when risk_track is null', () => {
    const out = evaluateRiskEligibility({
      account: { risk_track: null, starting_balance: 10000 },
      trades: [day(0, 10)],
      daily: [{ date: '2025-01-01', pnl: 10 }],
      maxDd: 100,
    });
    expect(out.status).toBe('unconfigured');
    expect(out.eligible).toBe(false);
  });

  it('fails short history', () => {
    const trades = [day(0, 10), day(30, -20)];
    const out = evaluateRiskEligibility({
      account: { risk_track: 'master', starting_balance: 10000 },
      trades,
      daily: [
        { date: '2025-01-01', pnl: 10 },
        { date: '2025-01-31', pnl: -20 },
      ],
      maxDd: 20,
    });
    expect(out.eligible).toBe(false);
    expect(out.failedRules).toContain('history_6m');
  });

  it('fails daily loss above 1%', () => {
    const trades = [];
    for (let i = 0; i < 200; i++) trades.push(day(i % 28, i === 50 ? -200 : 5));
    // Force dates spanning 200 days via explicit dates
    const longTrades = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      return {
        date: iso,
        pnl_usd: i === 50 ? -200 : 5,
        result: i === 50 ? 'loss' : 'win',
        r_value: 0,
      };
    });
    const daily = longTrades.map((t) => ({ date: t.date, pnl: t.pnl_usd }));
    const out = evaluateRiskEligibility({
      account: { risk_track: 'ea', starting_balance: 10000 },
      trades: longTrades,
      daily,
      maxDd: 50,
    });
    expect(out.failedRules).toContain('daily_loss_1pct');
  });

  it('fails master on 3-loss streak', () => {
    const longTrades = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      const iso = d.toISOString().slice(0, 10);
      const streak = i >= 100 && i <= 102;
      return {
        date: iso,
        pnl_usd: streak ? -10 : 5,
        result: streak ? 'loss' : 'win',
        r_value: 0,
      };
    });
    const daily = longTrades.map((t) => ({ date: t.date, pnl: t.pnl_usd }));
    const out = evaluateRiskEligibility({
      account: { risk_track: 'master', starting_balance: 10000 },
      trades: longTrades,
      daily,
      maxDd: 30,
    });
    expect(out.failedRules).toContain('losing_streak_3');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `cd finhubkh_journal && npm test -- src/lib/riskEligibility.test.js`

Expected: FAIL resolving `./riskEligibility.js`

- [ ] **Step 3: Implement `src/lib/riskEligibility.js`**

```js
/** Master / EA journal eligibility (mirrors SQL refresh math). */

export const RISK_RULE_IDS = {
  HISTORY: 'history_6m',
  DAILY: 'daily_loss_1pct',
  OVERALL: 'overall_loss_10pct',
  DD: 'max_dd_10pct',
  RISK_TRADE: 'risk_per_trade_1pct',
  STREAK: 'losing_streak_3',
  PERF: 'perf_report_ready',
  EQUITY: 'equity_base_missing',
};

const DAY_MS = 86400000;

export function normalizeRiskTrack(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'master' || v === 'ea') return v;
  return null;
}

export function equityBase(account, peakEquity = 0) {
  const start = Number(account?.starting_balance) || 0;
  if (start > 0) return start;
  const peak = Number(peakEquity) || 0;
  return peak > 0 ? peak : 0;
}

export function historyDays(trades) {
  if (!trades?.length) return 0;
  const times = trades
    .map((t) => new Date(t.date || t.close_time || t.created_at).getTime())
    .filter((n) => Number.isFinite(n));
  if (!times.length) return 0;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return Math.floor((max - min) / DAY_MS) + 1;
}

export function maxDailyLossPct(daily, base) {
  if (!base) return null;
  let worst = 0;
  for (const row of daily || []) {
    const pnl = Number(row.pnl ?? row.pnl_usd) || 0;
    if (pnl < worst) worst = pnl;
  }
  return Math.abs(worst) / base;
}

export function maxOverallLossPct(trades, base) {
  if (!base) return null;
  const sorted = [...(trades || [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  let cum = 0;
  let worst = 0;
  for (const t of sorted) {
    cum += Number(t.pnl_usd) || 0;
    if (cum < worst) worst = cum;
  }
  return Math.abs(Math.min(0, worst)) / base;
}

export function maxDrawdownPct(maxDd, base) {
  if (!base) return null;
  return (Number(maxDd) || 0) / base;
}

export function riskPerTradeBreaches(trades, base, avgLoss) {
  if (!base) return [];
  const breaches = [];
  for (const t of trades || []) {
    const r = Number(t.r_value) || 0;
    let risk = 0;
    if (Math.abs(r) > 0.01 && avgLoss > 0) risk = Math.abs(r) * avgLoss;
    else if (t.result === 'loss') risk = Math.abs(Number(t.pnl_usd) || 0);
    else continue;
    if (risk / base > 0.01 + 1e-9) breaches.push(t.id || t.date);
  }
  return breaches;
}

export function hasLosingStreakOf(trades, n = 3) {
  const sorted = [...(trades || [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  let streak = 0;
  for (const t of sorted) {
    if (t.result === 'loss') {
      streak += 1;
      if (streak >= n) return true;
    } else if (t.result === 'win') {
      streak = 0;
    }
  }
  return false;
}

function avgLossAbs(trades) {
  const losses = (trades || []).filter((t) => t.result === 'loss');
  if (!losses.length) return 0;
  return (
    Math.abs(losses.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0)) /
    losses.length
  );
}

function peakFromTrades(trades) {
  const sorted = [...(trades || [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  let cum = 0;
  let peak = 0;
  for (const t of sorted) {
    cum += Number(t.pnl_usd) || 0;
    if (cum > peak) peak = cum;
  }
  return peak;
}

/**
 * @returns {{
 *   status: 'unconfigured'|'needs_history'|'eligible'|'not_eligible',
 *   eligible: boolean,
 *   track: 'master'|'ea'|null,
 *   failedRules: string[],
 *   metrics: Record<string, number|boolean|null>,
 *   rules: Array<{ id: string, pass: boolean|null, actual: number|null, limit: number|null }>
 * }}
 */
export function evaluateRiskEligibility({
  account,
  trades,
  daily,
  maxDd,
}) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track) {
    return {
      status: 'unconfigured',
      eligible: false,
      track: null,
      failedRules: [],
      metrics: {},
      rules: [],
    };
  }

  const peak = peakFromTrades(trades);
  const base = equityBase(account, peak);
  const failed = [];
  const metrics = { equity_base: base, peak_equity: peak };
  const rules = [];

  if (!base) {
    failed.push(RISK_RULE_IDS.EQUITY);
    return {
      status: 'not_eligible',
      eligible: false,
      track,
      failedRules: failed,
      metrics,
      rules: [{ id: RISK_RULE_IDS.EQUITY, pass: false, actual: null, limit: null }],
    };
  }

  const days = historyDays(trades);
  metrics.history_days = days;
  const histPass = days >= 182;
  rules.push({ id: RISK_RULE_IDS.HISTORY, pass: histPass, actual: days, limit: 182 });
  if (!histPass) failed.push(RISK_RULE_IDS.HISTORY);

  const dailyPct = maxDailyLossPct(daily, base);
  metrics.max_daily_loss_pct = dailyPct;
  const dailyPass = dailyPct != null && dailyPct <= 0.01;
  rules.push({ id: RISK_RULE_IDS.DAILY, pass: dailyPass, actual: dailyPct, limit: 0.01 });
  if (!dailyPass) failed.push(RISK_RULE_IDS.DAILY);

  const overallPct = maxOverallLossPct(trades, base);
  metrics.max_overall_loss_pct = overallPct;
  const overallPass = overallPct != null && overallPct <= 0.1;
  rules.push({ id: RISK_RULE_IDS.OVERALL, pass: overallPass, actual: overallPct, limit: 0.1 });
  if (!overallPass) failed.push(RISK_RULE_IDS.OVERALL);

  const ddPct = maxDrawdownPct(maxDd, base);
  metrics.max_dd_pct = ddPct;
  const ddPass = ddPct != null && ddPct <= 0.1;
  rules.push({ id: RISK_RULE_IDS.DD, pass: ddPass, actual: ddPct, limit: 0.1 });
  if (!ddPass) failed.push(RISK_RULE_IDS.DD);

  const avgL = avgLossAbs(trades);
  const breaches = riskPerTradeBreaches(trades, base, avgL);
  metrics.risk_per_trade_breaches = breaches.length;
  const riskPass = breaches.length === 0;
  rules.push({ id: RISK_RULE_IDS.RISK_TRADE, pass: riskPass, actual: breaches.length, limit: 0 });
  if (!riskPass) failed.push(RISK_RULE_IDS.RISK_TRADE);

  if (track === 'master') {
    const streakFail = hasLosingStreakOf(trades, 3);
    metrics.losing_streak_3 = streakFail;
    rules.push({ id: RISK_RULE_IDS.STREAK, pass: !streakFail, actual: streakFail ? 1 : 0, limit: 0 });
    if (streakFail) failed.push(RISK_RULE_IDS.STREAK);
  }

  if (track === 'ea') {
    const ready = (trades?.length || 0) > 0 && days >= 1;
    metrics.perf_report_ready = ready;
    rules.push({ id: RISK_RULE_IDS.PERF, pass: ready, actual: ready ? 1 : 0, limit: 1 });
    if (!ready) failed.push(RISK_RULE_IDS.PERF);
  }

  const eligible = failed.length === 0;
  let status = eligible ? 'eligible' : 'not_eligible';
  if (!histPass) status = 'needs_history';

  return { status, eligible, track, failedRules: failed, metrics, rules };
}

export function riskBadgeLabel(track, eligible) {
  if (!eligible) return null;
  if (track === 'master') return 'Master';
  if (track === 'ea') return 'EA Safe';
  return null;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/riskEligibility.test.js`  
Expected: all tests PASS (adjust fixture dates in the test if `historyDays` off-by-one fails).

- [ ] **Step 5: Commit**

```bash
git add src/lib/riskEligibility.js src/lib/riskEligibility.test.js
git commit -m "Add journal risk eligibility rule engine with tests."
```

---

### Task 2: DB columns + SQL refresh function

**Files:**
- Create: `backend/migrations/2026-09-15_account_risk_eligibility.sql`

- [ ] **Step 1: Create migration**

Apply the same formulas as `riskEligibility.js`. Core shape:

```sql
-- backend/migrations/2026-09-15_account_risk_eligibility.sql
alter table trading_accounts
  add column if not exists risk_track text,
  add column if not exists risk_eligible boolean not null default false,
  add column if not exists risk_failed_rules jsonb not null default '[]'::jsonb,
  add column if not exists risk_metrics jsonb not null default '{}'::jsonb,
  add column if not exists risk_checked_at timestamptz;

alter table trading_accounts
  drop constraint if exists trading_accounts_risk_track_check;

alter table trading_accounts
  add constraint trading_accounts_risk_track_check
  check (risk_track is null or risk_track in ('master', 'ea'));

create or replace function public.refresh_account_risk_eligibility(p_account_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
  track text;
  start_bal numeric;
  base numeric;
  peak numeric;
  days int;
  daily_pct numeric;
  overall_pct numeric;
  dd_abs numeric;
  dd_pct numeric;
  avg_loss numeric;
  breach_count int;
  streak_fail boolean;
  failed jsonb;
  metrics jsonb;
  eligible boolean;
begin
  if p_account_ids is null then return; end if;
  foreach aid in array p_account_ids loop
    select risk_track, coalesce(starting_balance, 0)
      into track, start_bal
    from trading_accounts where id = aid;
    if track is null then
      update trading_accounts set
        risk_eligible = false,
        risk_failed_rules = '[]'::jsonb,
        risk_metrics = '{}'::jsonb,
        risk_checked_at = now()
      where id = aid;
      continue;
    end if;

    -- peak equity from trade PnL curve
    select coalesce(max(c), 0) into peak
    from (
      select sum(coalesce(pnl_usd,0)) over (order by date, created_at) as c
      from trades where account_id = aid
    ) s;

    base := case when start_bal > 0 then start_bal when peak > 0 then peak else 0 end;
    failed := '[]'::jsonb;
    metrics := jsonb_build_object('equity_base', base, 'peak_equity', peak);

    if base <= 0 then
      update trading_accounts set
        risk_eligible = false,
        risk_failed_rules = '["equity_base_missing"]'::jsonb,
        risk_metrics = metrics,
        risk_checked_at = now()
      where id = aid;
      continue;
    end if;

    select greatest(1, (max(date) - min(date)) + 1)
      into days
    from trades where account_id = aid;
    days := coalesce(days, 0);
    metrics := metrics || jsonb_build_object('history_days', days);
    if days < 182 then
      failed := failed || '["history_6m"]'::jsonb;
    end if;

    select coalesce(abs(min(pnl)), 0) / base into daily_pct
    from account_daily_stats where account_id = aid and pnl < 0;
    daily_pct := coalesce(daily_pct, 0);
    metrics := metrics || jsonb_build_object('max_daily_loss_pct', daily_pct);
    if daily_pct > 0.01 then
      failed := failed || '["daily_loss_1pct"]'::jsonb;
    end if;

    select coalesce(abs(min(c)), 0) / base into overall_pct
    from (
      select sum(coalesce(pnl_usd,0)) over (order by date, created_at) as c
      from trades where account_id = aid
    ) s where c < 0;
    overall_pct := coalesce(overall_pct, 0);
    metrics := metrics || jsonb_build_object('max_overall_loss_pct', overall_pct);
    if overall_pct > 0.10 then
      failed := failed || '["overall_loss_10pct"]'::jsonb;
    end if;

    select coalesce(max_dd, 0) into dd_abs
    from account_trade_stats where account_id = aid;
    dd_pct := coalesce(dd_abs, 0) / base;
    metrics := metrics || jsonb_build_object('max_dd_pct', dd_pct);
    if dd_pct > 0.10 then
      failed := failed || '["max_dd_10pct"]'::jsonb;
    end if;

    select coalesce(avg(abs(pnl_usd)), 0) into avg_loss
    from trades where account_id = aid and result = 'loss';

    select count(*)::int into breach_count
    from trades t
    where t.account_id = aid
      and (
        (abs(coalesce(t.r_value,0)) > 0.01 and avg_loss > 0
          and (abs(t.r_value) * avg_loss) / base > 0.01)
        or (t.result = 'loss' and abs(coalesce(t.r_value,0)) <= 0.01
          and abs(coalesce(t.pnl_usd,0)) / base > 0.01)
      );
    metrics := metrics || jsonb_build_object('risk_per_trade_breaches', breach_count);
    if breach_count > 0 then
      failed := failed || '["risk_per_trade_1pct"]'::jsonb;
    end if;

    if track = 'master' then
      select exists (
        select 1 from (
          select result,
                 count(*) filter (where result = 'loss') over (
                   order by date, created_at
                   rows between 2 preceding and current row
                 ) as loss3
          from trades where account_id = aid
        ) x
        where result = 'loss' and loss3 >= 3
          and not exists (
            -- ensure the window is three consecutive losses: check lag
            select 1
          )
      ) into streak_fail;
      -- Simpler portable check: scan in plpgsql loop if window is awkward.
      -- Implement consecutive-loss loop in final migration if window SQL is wrong.
      streak_fail := coalesce(streak_fail, false);
      metrics := metrics || jsonb_build_object('losing_streak_3', streak_fail);
      if streak_fail then
        failed := failed || '["losing_streak_3"]'::jsonb;
      end if;
    end if;

    if track = 'ea' then
      if days < 1 then
        failed := failed || '["perf_report_ready"]'::jsonb;
      end if;
      metrics := metrics || jsonb_build_object('perf_report_ready', days >= 1);
    end if;

    eligible := jsonb_array_length(failed) = 0;
    update trading_accounts set
      risk_eligible = eligible,
      risk_failed_rules = failed,
      risk_metrics = metrics,
      risk_checked_at = now()
    where id = aid;
  end loop;
end;
$$;

revoke all on function public.refresh_account_risk_eligibility(uuid[]) from public, anon;
grant execute on function public.refresh_account_risk_eligibility(uuid[]) to authenticated, service_role;
```

**Important:** Implement the Master streak check with an explicit plpgsql loop over ordered trades (safer than window edge cases). Replace the placeholder `exists` block with:

```sql
streak_fail := false;
declare
  r text;
  streak int := 0;
begin
  for r in
    select result from trades where account_id = aid order by date, created_at
  loop
    if r = 'loss' then
      streak := streak + 1;
      if streak >= 3 then streak_fail := true; exit; end if;
    elsif r = 'win' then
      streak := 0;
    end if;
  end loop;
end;
```

(Nest as needed inside the foreach account loop.)

- [ ] **Step 2: Hook into existing trade-stats refresh**

At the end of `refresh_account_trade_stats` (latest definition in `2026-08-17_cached_journal_stats.sql` / `daily_stats_upsert`), append:

```sql
perform public.refresh_account_risk_eligibility(p_account_ids);
```

Do this by **re-creating** `refresh_account_trade_stats` in the new migration with the same body as production + the extra `perform` line (copy from the latest migration file in repo before editing).

- [ ] **Step 3: Extend `get_published_trading_account` account object**

Add to the `account` jsonb:

```sql
'risk_track', acc.risk_track,
'risk_eligible', acc.risk_eligible
```

Copy latest function body from `2026-08-17_fix_published_account_limit.sql` (or whatever is newest in prod) and add those two keys.

- [ ] **Step 4: Apply migration in Supabase** (SQL editor or your usual `db:check` / deploy path)

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/2026-09-15_account_risk_eligibility.sql
git commit -m "Add account risk eligibility columns and refresh SQL."
```

---

### Task 3: API + account helpers

**Files:**
- Modify: `src/api/index.js`
- Modify: `src/lib/accounts.js`
- Modify: `src/api/share.js`

- [ ] **Step 1: Extend `TRADING_ACCOUNT_SELECT`**

In `src/api/index.js`, add:

```js
  'risk_track',
  'risk_eligible',
  'risk_failed_rules',
  'risk_metrics',
  'risk_checked_at',
```

- [ ] **Step 2: Add RPC helper**

```js
export async function refreshAccountRiskEligibility(accountIds) {
  const ids = (accountIds || []).filter(Boolean);
  if (!ids.length) return;
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/refresh_account_risk_eligibility`, {
    method: 'POST',
    headers: authHeaders(getToken()),
    body: JSON.stringify({ p_account_ids: ids }),
  });
  if (!res.ok) throw new Error(await res.text());
}
```

- [ ] **Step 3: Helpers in `accounts.js`**

```js
export const RISK_TRACKS = [
  { value: 'master', label: 'Master' },
  { value: 'ea', label: 'EA / ATS' },
];

export function normalizeRiskTrack(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'master' || v === 'ea' ? v : null;
}

export function riskTrackLabel(value) {
  const v = normalizeRiskTrack(value);
  if (v === 'master') return 'Master';
  if (v === 'ea') return 'EA / ATS';
  return 'Not set';
}
```

- [ ] **Step 4: Map share payload**

In `src/api/share.js`, ensure published account mapping keeps `risk_track` and `risk_eligible` from RPC JSON.

- [ ] **Step 5: Commit**

```bash
git add src/api/index.js src/lib/accounts.js src/api/share.js
git commit -m "Expose risk eligibility fields in account and share APIs."
```

---

### Task 4: Risk eligibility panel on account detail

**Files:**
- Create: `src/components/settings/RiskEligibilityPanel.jsx`
- Modify: `src/pages/AccountDetailPage.jsx`

- [ ] **Step 1: Build panel**

Panel props: `account`, `trades` (account-scoped), `daily` (optional), `maxDd`, `onChanged`.

Behavior:
1. Dropdown sets `risk_track` via `updateTradingAccount`
2. Call `refreshAccountRiskEligibility([account.id])`
3. `onChanged()` reloads accounts
4. Render checklist from `evaluateRiskEligibility(...)` **and** show persisted `account.risk_eligible` / `risk_failed_rules` after refresh (prefer persisted for badge truth; use JS evaluate for actual/limit display)

UI copy: “Auto-checked from journal history. Operational EA controls are not verified in v1.”

Use existing `card` / `sectionLabel` / `CustomDropdown` / `btnSm` patterns from `InvestorSyncPanel.jsx`.

- [ ] **Step 2: Mount on `AccountDetailPage`**

Place a full-width panel above Sharing / Danger, titled “Master / EA eligibility”.

Pass trades filtered to this `account.id` from `AppDataContext` (or fetch page of trades if bundle lacks full list — use whatever Overview already uses for account view).

- [ ] **Step 3: Manual UI check**

- Unconfigured → prompt to choose track  
- Short history → Needs history  
- Switch Master ↔ EA updates rules list  

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/RiskEligibilityPanel.jsx src/pages/AccountDetailPage.jsx
git commit -m "Add Master/EA eligibility panel on account detail."
```

---

### Task 5: Overview status pill

**Files:**
- Create: `src/components/common/RiskStatusPill.jsx`
- Modify: `src/pages/OverviewPage.jsx`

- [ ] **Step 1: Pill component**

```jsx
// Shows only when viewMode === 'account' && activeAccount
// Text: "Master · Eligible" | "EA · 2 failing" | "Choose risk track"
// onClick → navigate(`/dashboard/accounts/${activeAccount.id}`)
```

- [ ] **Step 2: Place next to `SyncNowButton` in Overview header**

- [ ] **Step 3: Commit**

```bash
git add src/components/common/RiskStatusPill.jsx src/pages/OverviewPage.jsx
git commit -m "Show risk eligibility status on account overview."
```

---

### Task 6: Public share badge

**Files:**
- Modify: `src/pages/PublicSharePage.jsx`
- Modify: leaderboard card component if it renders published accounts (search `is_public` / leaderboard components)

- [ ] **Step 1: Badge next to account name**

```jsx
{account.risk_eligible && account.risk_track === 'master' ? (
  <span className="...">Master</span>
) : null}
{account.risk_eligible && account.risk_track === 'ea' ? (
  <span className="...">EA Safe</span>
) : null}
```

- [ ] **Step 2: Verify live revoke**

With a published eligible account, add a large losing day (or lower starting_balance) → refresh → badge disappears after sync/refresh eligibility.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PublicSharePage.jsx src/components/**/Leaderboard*.jsx
git commit -m "Show live Master/EA Safe badge on public share."
```

---

### Task 7: Optional create-flow track (minimal)

**Files:**
- Modify: `src/components/settings/TradingAccountsManager.jsx`

- [ ] **Step 1: On create wizard basics step, optional Risk track dropdown (Master / EA / Not set)**

Persist `risk_track` in `insertTradingAccount` / edit save. After save, call `refreshAccountRiskEligibility([id])`.

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/TradingAccountsManager.jsx
git commit -m "Allow setting Master/EA risk track when creating accounts."
```

---

### Task 8: Final verification

- [ ] **Step 1: Unit tests**

Run: `npm test -- src/lib/riskEligibility.test.js`  
Expected: PASS

- [ ] **Step 2: Lint**

Run: `npm run lint`  
Expected: no new errors in touched files

- [ ] **Step 3: Manual checklist**

1. Create/select account → set Master → see checklist  
2. History &lt; 6 months → Needs history  
3. Publish eligible account → badge on `/share/:token`  
4. Force fail (huge daily loss trade) → sync → badge gone  
5. Switch to EA track → streak rule hidden, perf rule shown  

- [ ] **Step 4: Push when user asks**

Do not push unless requested.

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Auto journal-only eligibility | 1, 2 |
| Master + EA tracks | 1, 4, 7 |
| Live revoke | 2 (refresh on trade stats), 6 |
| Private checklist | 4 |
| Overview pill | 5 |
| Public badge | 2 (RPC fields), 6 |
| Equity base / edge cases | 1, 2 |
| Out of scope items not built | — (intentionally omitted) |

## Notes for implementers

- Keep JS and SQL formulas aligned; if you change a constant (0.01 / 0.10 / 182), update both + tests.
- Prefer persisted `risk_eligible` for any public badge; never recompute-only on the client for share pages.
- Portfolio view must not invent a combined Master status.
