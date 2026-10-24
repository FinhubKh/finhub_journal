/** Master / EA journal eligibility (mirrors SQL refresh math). */

import { evaluateFormulaExpr, validateFormula } from './siacFormula.js';

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

export const DEFAULT_SIAC_CONFIG = {
  history_days_min: 182,
  daily_loss_max_pct: 0.01,
  overall_loss_max_pct: 0.1,
  max_dd_max_pct: 0.1,
  risk_per_trade_max_pct: 0.01,
  losing_streak_max: 3,
  enabled_rules: {
    [RISK_RULE_IDS.HISTORY]: true,
    [RISK_RULE_IDS.DAILY]: true,
    [RISK_RULE_IDS.OVERALL]: true,
    [RISK_RULE_IDS.DD]: true,
    [RISK_RULE_IDS.RISK_TRADE]: true,
    [RISK_RULE_IDS.STREAK]: true,
    [RISK_RULE_IDS.PERF]: true,
  },
  rule_labels: {
    [RISK_RULE_IDS.HISTORY]: 'Trading history ≥ 6 months',
    [RISK_RULE_IDS.DAILY]: 'Max daily loss ≤ 1%',
    [RISK_RULE_IDS.OVERALL]: 'Max overall loss ≤ 10%',
    [RISK_RULE_IDS.DD]: 'Max drawdown ≤ 10%',
    [RISK_RULE_IDS.RISK_TRADE]: 'Risk per trade ≤ 1%',
    [RISK_RULE_IDS.STREAK]: 'Losing streak control (no 3+)',
    [RISK_RULE_IDS.PERF]: 'Performance report fields available',
    [RISK_RULE_IDS.EQUITY]: 'Equity base available',
  },
  custom_rules: [],
};

export function mergeSiacConfig(raw) {
  const base = DEFAULT_SIAC_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return {
      ...base,
      enabled_rules: { ...base.enabled_rules },
      rule_labels: { ...base.rule_labels },
      custom_rules: [],
    };
  }
  const customs = Array.isArray(raw.custom_rules)
    ? raw.custom_rules.map((row) => {
      const metric = row?.metric || 'guideline';
      const def = CUSTOM_METRIC_DEFS[metric];
      const opRaw = String(row?.operator || '').toLowerCase();
      const operator = opRaw === 'gte' || opRaw === 'lte'
        ? opRaw
        : (def?.defaultOp || 'gte');
      const formulaRaw = String(row?.formula || '').trim();
      const formula = metric === 'formula'
        ? (validateFormula(formulaRaw).ok ? formulaRaw : formulaRaw.slice(0, 200))
        : '';
      return {
        id: String(row?.id || ''),
        type_name: String(row?.type_name || row?.label || 'Custom rule'),
        label: String(row?.label || 'Custom rule'),
        enabled: row?.enabled !== false,
        tracks: ['both', 'master', 'ea'].includes(row?.tracks) ? row.tracks : 'both',
        metric,
        operator,
        limit: row?.limit == null || row?.limit === '' ? null : Number(row.limit),
        limit_text: String(row?.limit_text || ''),
        formula,
      };
    }).filter((row) => row.id)
    : [];
  return {
    history_days_min: Number(raw.history_days_min) || base.history_days_min,
    daily_loss_max_pct: Number(raw.daily_loss_max_pct) || base.daily_loss_max_pct,
    overall_loss_max_pct: Number(raw.overall_loss_max_pct) || base.overall_loss_max_pct,
    max_dd_max_pct: Number(raw.max_dd_max_pct) || base.max_dd_max_pct,
    risk_per_trade_max_pct: Number(raw.risk_per_trade_max_pct) || base.risk_per_trade_max_pct,
    losing_streak_max: Number(raw.losing_streak_max) || base.losing_streak_max,
    enabled_rules: { ...base.enabled_rules, ...(raw.enabled_rules || {}) },
    rule_labels: { ...base.rule_labels, ...(raw.rule_labels || {}) },
    custom_rules: customs,
    updated_at: raw.updated_at || null,
  };
}

/** Custom SIAC scoring metrics available to admins. */
export const CUSTOM_METRIC_DEFS = {
  history_days: {
    label: 'Trading history (days)',
    kind: 'int',
    unit: 'days',
    defaultOp: 'gte',
    defaultLimit: 182,
    group: 'History',
  },
  trade_count: {
    label: 'Closed trades (count)',
    kind: 'int',
    unit: 'trades',
    defaultOp: 'gte',
    defaultLimit: 50,
    group: 'Activity',
  },
  win_rate: {
    label: 'Win rate (%)',
    kind: 'pct',
    unit: '%',
    defaultOp: 'gte',
    defaultLimit: 0.5,
    group: 'Performance',
  },
  profit_factor: {
    label: 'Profit factor',
    kind: 'num',
    unit: 'PF',
    defaultOp: 'gte',
    defaultLimit: 1.2,
    group: 'Performance',
  },
  total_pnl_pct: {
    label: 'Total trade PnL (% of capital)',
    kind: 'pct',
    unit: '%',
    defaultOp: 'gte',
    defaultLimit: 0.05,
    group: 'Performance',
  },
  daily_loss_pct: {
    label: 'Max daily loss (%)',
    kind: 'pct',
    unit: '%',
    defaultOp: 'lte',
    defaultLimit: 0.01,
    group: 'Risk',
  },
  overall_loss_pct: {
    label: 'Max overall loss (%)',
    kind: 'pct',
    unit: '%',
    defaultOp: 'lte',
    defaultLimit: 0.1,
    group: 'Risk',
  },
  max_dd_pct: {
    label: 'Max drawdown (%)',
    kind: 'pct',
    unit: '%',
    defaultOp: 'lte',
    defaultLimit: 0.1,
    group: 'Risk',
  },
  risk_per_trade_pct: {
    label: 'Risk per trade (%)',
    kind: 'pct',
    unit: '%',
    defaultOp: 'lte',
    defaultLimit: 0.01,
    group: 'Risk',
    special: 'breaches',
  },
  losing_streak: {
    label: 'Losing streak (count)',
    kind: 'int',
    unit: 'losses',
    defaultOp: 'lte',
    defaultLimit: 3,
    group: 'Risk',
    special: 'streak',
  },
  formula: {
    label: 'Custom formula',
    kind: 'num',
    unit: '',
    defaultOp: 'gte',
    defaultLimit: 1,
    group: 'Other',
    special: 'formula',
  },
  guideline: {
    label: 'Guideline (display only)',
    kind: null,
    unit: null,
    defaultOp: 'gte',
    defaultLimit: null,
    group: 'Other',
  },
};

export function customMetricOptions() {
  return Object.entries(CUSTOM_METRIC_DEFS).map(([value, def]) => ({
    value,
    label: def.label,
    kind: def.kind,
    unit: def.unit,
    defaultOp: def.defaultOp,
    defaultLimit: def.defaultLimit,
    group: def.group,
    special: def.special || null,
  }));
}

export function customRuleApplies(rule, track) {
  if (!rule || rule.enabled === false) return false;
  const tracks = rule.tracks || 'both';
  if (tracks === 'both') return true;
  return tracks === track;
}

export function compareMetric(actual, limit, operator = 'gte') {
  if (actual == null || !Number.isFinite(Number(actual))) return false;
  if (!Number.isFinite(Number(limit))) return false;
  const a = Number(actual);
  const l = Number(limit);
  return operator === 'lte' ? a <= l : a >= l;
}

export function tradeOutcomeStats(trades) {
  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let totalPnl = 0;
  for (const t of trades || []) {
    const pnl = Number(t.pnl_usd) || 0;
    totalPnl += pnl;
    if (t.result === 'win') {
      wins += 1;
      grossWin += Math.max(0, pnl);
    } else if (t.result === 'loss') {
      losses += 1;
      grossLoss += Math.abs(pnl);
    }
  }
  const decided = wins + losses;
  return {
    tradeCount: (trades || []).length,
    wins,
    losses,
    grossWin,
    grossLoss,
    winRate: decided > 0 ? wins / decided : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Number.POSITIVE_INFINITY : null),
    totalPnl,
  };
}

/** Build allowlisted vars for custom formula evaluation. */
export function buildFormulaVars({
  days,
  base,
  dailyPct,
  overallPct,
  ddPct,
  riskBreaches,
  outcomes,
  totalPnlPct,
}) {
  const pf = outcomes?.profitFactor;
  return {
    history_days: days,
    trade_count: outcomes?.tradeCount ?? 0,
    win_rate: outcomes?.winRate,
    profit_factor: Number.isFinite(pf) ? pf : null,
    total_pnl_pct: totalPnlPct,
    daily_loss_pct: dailyPct,
    overall_loss_pct: overallPct,
    max_dd_pct: ddPct,
    risk_breaches: riskBreaches ?? 0,
    wins: outcomes?.wins ?? 0,
    losses: outcomes?.losses ?? 0,
    gross_win: outcomes?.grossWin ?? 0,
    gross_loss: outcomes?.grossLoss ?? 0,
    total_pnl: outcomes?.totalPnl ?? 0,
    base: base ?? 0,
  };
}

export function isRuleEnabled(config, ruleId) {
  const en = config?.enabled_rules;
  if (!en || typeof en !== 'object') return true;
  if (en[ruleId] === false) return false;
  return true;
}

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

export function riskPerTradeBreaches(trades, base, avgLoss, maxPct = 0.01) {
  if (!base) return [];
  const breaches = [];
  for (const t of trades || []) {
    const r = Number(t.r_value) || 0;
    let risk = 0;
    if (Math.abs(r) > 0.01 && avgLoss > 0) risk = Math.abs(r) * avgLoss;
    else if (t.result === 'loss') risk = Math.abs(Number(t.pnl_usd) || 0);
    else continue;
    if (risk / base > maxPct + 1e-9) breaches.push(t.id || t.date);
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
  config: rawConfig,
}) {
  const config = mergeSiacConfig(rawConfig);
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
  const metrics = {
    equity_base: base,
    peak_equity: peak,
    limits: {
      history_days_min: config.history_days_min,
      daily_loss_max_pct: config.daily_loss_max_pct,
      overall_loss_max_pct: config.overall_loss_max_pct,
      max_dd_max_pct: config.max_dd_max_pct,
      risk_per_trade_max_pct: config.risk_per_trade_max_pct,
      losing_streak_max: config.losing_streak_max,
    },
  };
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
  if (isRuleEnabled(config, RISK_RULE_IDS.HISTORY)) {
    const histPass = days >= config.history_days_min;
    rules.push({ id: RISK_RULE_IDS.HISTORY, pass: histPass, actual: days, limit: config.history_days_min });
    if (!histPass) failed.push(RISK_RULE_IDS.HISTORY);
  }

  const dailyPct = maxDailyLossPct(daily, base);
  metrics.max_daily_loss_pct = dailyPct;
  if (isRuleEnabled(config, RISK_RULE_IDS.DAILY)) {
    const dailyPass = dailyPct != null && dailyPct <= config.daily_loss_max_pct;
    rules.push({ id: RISK_RULE_IDS.DAILY, pass: dailyPass, actual: dailyPct, limit: config.daily_loss_max_pct });
    if (!dailyPass) failed.push(RISK_RULE_IDS.DAILY);
  }

  const overallPct = maxOverallLossPct(trades, base);
  metrics.max_overall_loss_pct = overallPct;
  if (isRuleEnabled(config, RISK_RULE_IDS.OVERALL)) {
    const overallPass = overallPct != null && overallPct <= config.overall_loss_max_pct;
    rules.push({ id: RISK_RULE_IDS.OVERALL, pass: overallPass, actual: overallPct, limit: config.overall_loss_max_pct });
    if (!overallPass) failed.push(RISK_RULE_IDS.OVERALL);
  }

  const ddPct = maxDrawdownPct(maxDd, base);
  metrics.max_dd_pct = ddPct;
  if (isRuleEnabled(config, RISK_RULE_IDS.DD)) {
    const ddPass = ddPct != null && ddPct <= config.max_dd_max_pct;
    rules.push({ id: RISK_RULE_IDS.DD, pass: ddPass, actual: ddPct, limit: config.max_dd_max_pct });
    if (!ddPass) failed.push(RISK_RULE_IDS.DD);
  }

  const avgL = avgLossAbs(trades);
  const breaches = riskPerTradeBreaches(trades, base, avgL, config.risk_per_trade_max_pct);
  metrics.risk_per_trade_breaches = breaches.length;
  if (isRuleEnabled(config, RISK_RULE_IDS.RISK_TRADE)) {
    const riskPass = breaches.length === 0;
    rules.push({ id: RISK_RULE_IDS.RISK_TRADE, pass: riskPass, actual: breaches.length, limit: 0 });
    if (!riskPass) failed.push(RISK_RULE_IDS.RISK_TRADE);
  }

  if (track === 'master' && isRuleEnabled(config, RISK_RULE_IDS.STREAK)) {
    const streakFail = hasLosingStreakOf(trades, config.losing_streak_max);
    metrics.losing_streak_3 = streakFail;
    rules.push({ id: RISK_RULE_IDS.STREAK, pass: !streakFail, actual: streakFail ? 1 : 0, limit: 0 });
    if (streakFail) failed.push(RISK_RULE_IDS.STREAK);
  }

  if (track === 'ea' && isRuleEnabled(config, RISK_RULE_IDS.PERF)) {
    const ready = (trades?.length || 0) > 0 && days >= 1;
    metrics.perf_report_ready = ready;
    rules.push({ id: RISK_RULE_IDS.PERF, pass: ready, actual: ready ? 1 : 0, limit: 1 });
    if (!ready) failed.push(RISK_RULE_IDS.PERF);
  }

  const outcomes = tradeOutcomeStats(trades);
  metrics.trade_count = outcomes.tradeCount;
  metrics.win_rate = outcomes.winRate;
  metrics.profit_factor = Number.isFinite(outcomes.profitFactor) ? outcomes.profitFactor : null;
  metrics.total_pnl_pct = base > 0 ? outcomes.totalPnl / base : null;

  for (const custom of config.custom_rules || []) {
    if (!customRuleApplies(custom, track)) continue;
    const metric = custom.metric || 'guideline';
    const def = CUSTOM_METRIC_DEFS[metric];
    if (metric === 'guideline' || !def) {
      if (metric === 'guideline') {
        rules.push({
          id: custom.id,
          pass: true,
          actual: null,
          limit: null,
          label: custom.label,
          limitText: custom.limit_text || null,
          guideline: true,
        });
      }
      continue;
    }
    const limit = Number(custom.limit);
    const operator = custom.operator === 'lte' || custom.operator === 'gte'
      ? custom.operator
      : (def.defaultOp || 'gte');
    let pass = true;
    let actual = null;
    let displayLimit = Number.isFinite(limit) ? limit : null;

    if (metric === 'history_days') actual = days;
    else if (metric === 'trade_count') actual = outcomes.tradeCount;
    else if (metric === 'win_rate') actual = outcomes.winRate;
    else if (metric === 'profit_factor') {
      actual = outcomes.profitFactor;
      if (actual === Number.POSITIVE_INFINITY) {
        pass = Number.isFinite(limit);
        actual = null;
        displayLimit = Number.isFinite(limit) ? limit : null;
        rules.push({
          id: custom.id, pass, actual: Number.POSITIVE_INFINITY, limit: displayLimit,
          label: custom.label, metric, operator,
        });
        if (!pass) failed.push(custom.id);
        continue;
      }
    } else if (metric === 'total_pnl_pct') actual = metrics.total_pnl_pct;
    else if (metric === 'daily_loss_pct') actual = dailyPct;
    else if (metric === 'overall_loss_pct') actual = overallPct;
    else if (metric === 'max_dd_pct') actual = ddPct;
    else if (metric === 'risk_per_trade_pct') {
      const customBreaches = riskPerTradeBreaches(trades, base, avgL, Number.isFinite(limit) ? limit : 0.01);
      actual = customBreaches.length;
      displayLimit = 0;
      pass = customBreaches.length === 0;
      rules.push({
        id: custom.id, pass, actual, limit: displayLimit,
        label: custom.label, metric, operator: 'lte',
      });
      if (!pass) failed.push(custom.id);
      continue;
    }     else if (metric === 'losing_streak') {
      const streakLimit = Number.isFinite(limit) ? limit : 3;
      const streakFail = hasLosingStreakOf(trades, streakLimit);
      actual = streakFail ? streakLimit : 0;
      displayLimit = streakLimit;
      pass = !streakFail;
      rules.push({
        id: custom.id, pass, actual, limit: displayLimit,
        label: custom.label, metric, operator: 'lte',
      });
      if (!pass) failed.push(custom.id);
      continue;
    } else if (metric === 'formula') {
      const formulaVars = buildFormulaVars({
        days,
        base,
        dailyPct,
        overallPct,
        ddPct,
        riskBreaches: breaches.length,
        outcomes,
        totalPnlPct: metrics.total_pnl_pct,
      });
      const evaluated = evaluateFormulaExpr(custom.formula || '', formulaVars);
      actual = evaluated.ok ? evaluated.value : null;
      pass = evaluated.ok && compareMetric(actual, limit, operator);
      rules.push({
        id: custom.id,
        pass,
        actual,
        limit: displayLimit,
        label: custom.label,
        metric,
        operator,
        formula: custom.formula || '',
      });
      if (!pass) failed.push(custom.id);
      continue;
    } else {
      continue;
    }

    pass = compareMetric(actual, limit, operator);
    rules.push({
      id: custom.id,
      pass,
      actual,
      limit: displayLimit,
      label: custom.label,
      metric,
      operator,
    });
    if (!pass) failed.push(custom.id);
  }

  const eligible = failed.length === 0;
  let status = eligible ? 'eligible' : 'not_eligible';
  if (failed.includes(RISK_RULE_IDS.HISTORY)) status = 'needs_history';

  return { status, eligible, track, failedRules: failed, metrics, rules };
}
