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
