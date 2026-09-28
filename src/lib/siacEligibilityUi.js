/** Shared SIAC eligibility presentation helpers (UI copy + persisted rules). */

import { normalizeRiskTrack } from './accounts';
import {
  DEFAULT_SIAC_CONFIG,
  RISK_RULE_IDS,
  customRuleApplies,
  mergeSiacConfig,
} from './riskEligibility';

export const RULE_COPY = { ...DEFAULT_SIAC_CONFIG.rule_labels };

export function ruleLabel(id, config) {
  const labels = config?.rule_labels || RULE_COPY;
  if (labels[id]) return labels[id];
  const custom = (config?.custom_rules || []).find((row) => row.id === id);
  if (custom?.label) return custom.label;
  return RULE_COPY[id] || id;
}

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

export function formatRuleActual(id, actual, config, rule) {
  const cfg = mergeSiacConfig(config);
  if (rule?.guideline) return 'Guideline';
  if (actual == null) return '—';
  const metric = rule?.metric;
  if (id === RISK_RULE_IDS.HISTORY || metric === 'history_days') {
    const days = Number(actual) || 0;
    const months = (days / 30.44).toFixed(1);
    return `${days} days (~${months} mo)`;
  }
  if (
    id === RISK_RULE_IDS.DAILY
    || id === RISK_RULE_IDS.OVERALL
    || id === RISK_RULE_IDS.DD
    || metric === 'daily_loss_pct'
    || metric === 'overall_loss_pct'
    || metric === 'max_dd_pct'
  ) {
    return formatPct(actual);
  }
  if (id === RISK_RULE_IDS.RISK_TRADE || metric === 'risk_per_trade_pct') {
    const n = Number(actual) || 0;
    return n === 0 ? '0 breaches' : `${n} breach${n === 1 ? '' : 'es'}`;
  }
  if (id === RISK_RULE_IDS.STREAK || metric === 'losing_streak') {
    const max = Number(rule?.limit) || cfg.losing_streak_max;
    return Number(actual) ? `${max || 3}+ streak found` : `No ${max || 3}+ streak`;
  }
  if (id === RISK_RULE_IDS.PERF) {
    return Number(actual) ? 'Available' : 'Unavailable';
  }
  if (id === RISK_RULE_IDS.EQUITY) return 'Missing';
  return String(actual);
}

export function formatRuleLimit(id, limit, config, rule) {
  const cfg = mergeSiacConfig(config);
  if (rule?.guideline) return rule.limitText || '—';
  const metric = rule?.metric;
  if (limit == null && id !== RISK_RULE_IDS.STREAK && id !== RISK_RULE_IDS.PERF && id !== RISK_RULE_IDS.RISK_TRADE && metric !== 'losing_streak' && metric !== 'risk_per_trade_pct') {
    return '—';
  }
  if (id === RISK_RULE_IDS.HISTORY || metric === 'history_days') return `${limit ?? cfg.history_days_min} days`;
  if (
    id === RISK_RULE_IDS.DAILY
    || id === RISK_RULE_IDS.OVERALL
    || id === RISK_RULE_IDS.DD
    || metric === 'daily_loss_pct'
    || metric === 'overall_loss_pct'
    || metric === 'max_dd_pct'
  ) {
    return formatPct(limit);
  }
  if (id === RISK_RULE_IDS.RISK_TRADE || metric === 'risk_per_trade_pct') return '0 breaches';
  if (id === RISK_RULE_IDS.STREAK || metric === 'losing_streak') {
    const max = Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Number(limit)
      : cfg.losing_streak_max;
    return `No ${max}+ streak`;
  }
  if (id === RISK_RULE_IDS.PERF) return 'Available';
  return String(limit);
}

function limitsFromMetrics(metrics) {
  const lim = metrics?.limits;
  if (lim && typeof lim === 'object') return lim;
  return null;
}

export function rulesFromPersisted(account, track, config) {
  const metrics = account?.risk_metrics && typeof account.risk_metrics === 'object'
    ? account.risk_metrics
    : {};
  const cfg = mergeSiacConfig({
    ...config,
    ...(limitsFromMetrics(metrics) || {}),
    custom_rules: config?.custom_rules,
  });
  const failed = new Set(asFailedList(account?.risk_failed_rules));
  const rules = [];

  if (failed.has(RISK_RULE_IDS.EQUITY)) {
    return [{ id: RISK_RULE_IDS.EQUITY, pass: false, actual: null, limit: null }];
  }

  const push = (id, actual, limit, extra = {}) => {
    if (cfg.enabled_rules?.[id] === false) return;
    rules.push({
      id,
      pass: !failed.has(id),
      actual: actual ?? null,
      limit: limit ?? null,
      ...extra,
    });
  };

  push(RISK_RULE_IDS.HISTORY, metrics.history_days, cfg.history_days_min);
  push(RISK_RULE_IDS.DAILY, metrics.max_daily_loss_pct, cfg.daily_loss_max_pct);
  push(RISK_RULE_IDS.OVERALL, metrics.max_overall_loss_pct, cfg.overall_loss_max_pct);
  push(RISK_RULE_IDS.DD, metrics.max_dd_pct, cfg.max_dd_max_pct);
  push(RISK_RULE_IDS.RISK_TRADE, metrics.risk_per_trade_breaches, 0);
  if (track === 'master') {
    push(RISK_RULE_IDS.STREAK, metrics.losing_streak_3 ? 1 : 0, 0);
  }
  if (track === 'ea') {
    push(RISK_RULE_IDS.PERF, metrics.perf_report_ready ? 1 : 0, 1);
  }

  for (const custom of cfg.custom_rules || []) {
    if (!customRuleApplies(custom, track)) continue;
    if (custom.metric === 'guideline') {
      rules.push({
        id: custom.id,
        pass: true,
        actual: null,
        limit: null,
        label: custom.label,
        limitText: custom.limit_text || null,
        guideline: true,
      });
      continue;
    }
    let actual = null;
    let limit = custom.limit;
    if (custom.metric === 'history_days') actual = metrics.history_days;
    else if (custom.metric === 'daily_loss_pct') actual = metrics.max_daily_loss_pct;
    else if (custom.metric === 'overall_loss_pct') actual = metrics.max_overall_loss_pct;
    else if (custom.metric === 'max_dd_pct') actual = metrics.max_dd_pct;
    else if (custom.metric === 'risk_per_trade_pct') {
      actual = metrics.risk_per_trade_breaches;
      limit = 0;
    } else if (custom.metric === 'losing_streak') {
      actual = metrics.losing_streak_3 ? 1 : 0;
      limit = 0;
    }
    rules.push({
      id: custom.id,
      pass: !failed.has(custom.id),
      actual,
      limit,
      label: custom.label,
      metric: custom.metric,
    });
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
