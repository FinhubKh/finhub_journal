/** Shared SIAC eligibility presentation helpers (UI copy + persisted rules). */

import { normalizeRiskTrack } from './accounts';
import { RISK_RULE_IDS } from './riskEligibility';

export const RULE_COPY = {
  [RISK_RULE_IDS.HISTORY]: 'Trading history ≥ 6 months',
  [RISK_RULE_IDS.DAILY]: 'Max daily loss ≤ 1%',
  [RISK_RULE_IDS.OVERALL]: 'Max overall loss ≤ 10%',
  [RISK_RULE_IDS.DD]: 'Max drawdown ≤ 10%',
  [RISK_RULE_IDS.RISK_TRADE]: 'Risk per trade ≤ 1%',
  [RISK_RULE_IDS.STREAK]: 'Losing streak control (no 3+)',
  [RISK_RULE_IDS.PERF]: 'Performance report fields available',
  [RISK_RULE_IDS.EQUITY]: 'Equity base available',
};

export const SIAC_STATUS_STYLES = {
  eligible: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  not_eligible: 'bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-700',
  needs_history: 'bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-700',
  unconfigured: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700',
};

export const SIAC_STATUS_LABELS = {
  eligible: 'Eligible',
  not_eligible: 'Open items',
  needs_history: 'Building history',
  unconfigured: 'Not set',
};

export function asFailedList(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

export function formatRuleActual(id, actual) {
  if (actual == null) return '—';
  if (id === RISK_RULE_IDS.HISTORY) {
    const days = Number(actual) || 0;
    const months = (days / 30.44).toFixed(1);
    return `${days} days (~${months} mo)`;
  }
  if (
    id === RISK_RULE_IDS.DAILY
    || id === RISK_RULE_IDS.OVERALL
    || id === RISK_RULE_IDS.DD
  ) {
    return formatPct(actual);
  }
  if (id === RISK_RULE_IDS.RISK_TRADE) {
    const n = Number(actual) || 0;
    return n === 0 ? '0 breaches' : `${n} breach${n === 1 ? '' : 'es'}`;
  }
  if (id === RISK_RULE_IDS.STREAK) {
    return Number(actual) ? '3+ streak found' : 'No 3+ streak';
  }
  if (id === RISK_RULE_IDS.PERF) {
    return Number(actual) ? 'Available' : 'Unavailable';
  }
  if (id === RISK_RULE_IDS.EQUITY) return 'Missing';
  return String(actual);
}

export function formatRuleLimit(id, limit) {
  if (limit == null) return '—';
  if (id === RISK_RULE_IDS.HISTORY) return `${limit} days`;
  if (
    id === RISK_RULE_IDS.DAILY
    || id === RISK_RULE_IDS.OVERALL
    || id === RISK_RULE_IDS.DD
  ) {
    return formatPct(limit);
  }
  if (id === RISK_RULE_IDS.RISK_TRADE) return '0 breaches';
  if (id === RISK_RULE_IDS.STREAK) return 'No 3+ streak';
  if (id === RISK_RULE_IDS.PERF) return 'Available';
  return String(limit);
}

export function rulesFromPersisted(account, track) {
  const metrics = account?.risk_metrics && typeof account.risk_metrics === 'object'
    ? account.risk_metrics
    : {};
  const failed = new Set(asFailedList(account?.risk_failed_rules));
  const rules = [];

  if (failed.has(RISK_RULE_IDS.EQUITY)) {
    return [{ id: RISK_RULE_IDS.EQUITY, pass: false, actual: null, limit: null }];
  }

  const push = (id, actual, limit) => {
    rules.push({
      id,
      pass: !failed.has(id),
      actual: actual ?? null,
      limit: limit ?? null,
    });
  };

  push(RISK_RULE_IDS.HISTORY, metrics.history_days, 182);
  push(RISK_RULE_IDS.DAILY, metrics.max_daily_loss_pct, 0.01);
  push(RISK_RULE_IDS.OVERALL, metrics.max_overall_loss_pct, 0.1);
  push(RISK_RULE_IDS.DD, metrics.max_dd_pct, 0.1);
  push(RISK_RULE_IDS.RISK_TRADE, metrics.risk_per_trade_breaches, 0);
  if (track === 'master') {
    push(RISK_RULE_IDS.STREAK, metrics.losing_streak_3 ? 1 : 0, 0);
  }
  if (track === 'ea') {
    push(RISK_RULE_IDS.PERF, metrics.perf_report_ready ? 1 : 0, 1);
  }
  return rules;
}

export function hasPersistedRiskSnapshot(account) {
  if (account?.risk_checked_at) return true;
  const metrics = account?.risk_metrics;
  return Boolean(metrics && typeof metrics === 'object' && Object.keys(metrics).length > 0);
}

export function needsRiskRefresh(account) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track || !account?.id) return false;
  if (account.risk_checked_at == null) return true;
  const metrics = account.risk_metrics;
  return !metrics || typeof metrics !== 'object' || Object.keys(metrics).length === 0;
}

export function resolveSiacStatus(account) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track) return 'unconfigured';
  if (account?.risk_eligible === true) return 'eligible';
  const failed = asFailedList(account?.risk_failed_rules);
  if (failed.includes(RISK_RULE_IDS.HISTORY)) return 'needs_history';
  return 'not_eligible';
}
