// src/components/settings/RiskEligibilityPanel.jsx
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { refreshAccountRiskEligibility, updateTradingAccount } from '../../api';
import CustomDropdown from '../common/CustomDropdown';
import { RISK_TRACKS, normalizeRiskTrack, riskTrackLabel } from '../../lib/accounts';
import {
  RISK_RULE_IDS,
  evaluateRiskEligibility,
} from '../../lib/riskEligibility';
import { label, msgError, sectionLabel, select } from '../../lib/ui';

const formSelectBtn = `${select} inline-flex items-center justify-between gap-2 text-left font-normal`;

const TRACK_OPTIONS = [
  { value: '', label: 'Not set' },
  ...RISK_TRACKS,
];

const RULE_COPY = {
  [RISK_RULE_IDS.HISTORY]: 'Trading history ≥ 6 months',
  [RISK_RULE_IDS.DAILY]: 'Max daily loss ≤ 1%',
  [RISK_RULE_IDS.OVERALL]: 'Max overall loss ≤ 10%',
  [RISK_RULE_IDS.DD]: 'Max drawdown ≤ 10%',
  [RISK_RULE_IDS.RISK_TRADE]: 'Risk per trade ≤ 1%',
  [RISK_RULE_IDS.STREAK]: 'Losing streak control (no 3+)',
  [RISK_RULE_IDS.PERF]: 'Performance report fields available',
  [RISK_RULE_IDS.EQUITY]: 'Equity base available',
};

const STATUS_STYLES = {
  eligible: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  not_eligible: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  needs_history: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  unconfigured: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700',
};

const STATUS_LABELS = {
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
  needs_history: 'Needs history',
  unconfigured: 'Choose track',
};

function asFailedList(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatRuleActual(id, actual) {
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

function formatRuleLimit(id, limit) {
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

function rulesFromPersisted(account, track) {
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

function hasPersistedRiskSnapshot(account) {
  if (account?.risk_checked_at) return true;
  const metrics = account?.risk_metrics;
  return Boolean(metrics && typeof metrics === 'object' && Object.keys(metrics).length > 0);
}

function needsRiskRefresh(account) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track || !account?.id) return false;
  if (account.risk_checked_at == null) return true;
  const metrics = account.risk_metrics;
  return !metrics || typeof metrics !== 'object' || Object.keys(metrics).length === 0;
}

function resolveStatus(account) {
  const track = normalizeRiskTrack(account?.risk_track);
  if (!track) return 'unconfigured';
  if (account?.risk_eligible === true) return 'eligible';
  const failed = asFailedList(account?.risk_failed_rules);
  if (failed.includes(RISK_RULE_IDS.HISTORY)) return 'needs_history';
  return 'not_eligible';
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.unconfigured}`}
    >
      {STATUS_LABELS[status] || STATUS_LABELS.unconfigured}
    </span>
  );
}

export default function RiskEligibilityPanel({
  account,
  trades = [],
  daily,
  maxDd = 0,
  onChanged,
}) {
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState(null);

  const trackValue = normalizeRiskTrack(account?.risk_track) || '';

  useEffect(() => {
    if (!needsRiskRefresh(account)) return undefined;

    let cancelled = false;
    setRefreshing(true);

    (async () => {
      try {
        await refreshAccountRiskEligibility([account.id]);
        if (!cancelled) await onChanged?.();
      } catch (err) {
        if (!cancelled) {
          setMsg(err.message || 'Could not refresh eligibility.');
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.risk_track]);

  const { status, rules, awaitingMetrics } = useMemo(() => {
    const track = normalizeRiskTrack(account?.risk_track);
    const tradesEmpty = !trades?.length;

    if (!track) {
      return { status: 'unconfigured', rules: [], awaitingMetrics: false };
    }

    const status = resolveStatus(account);

    if (tradesEmpty) {
      if (hasPersistedRiskSnapshot(account)) {
        return {
          status,
          rules: rulesFromPersisted(account, track),
          awaitingMetrics: false,
        };
      }
      return { status, rules: [], awaitingMetrics: true };
    }

    const evaluation = evaluateRiskEligibility({
      account,
      trades,
      daily,
      maxDd,
    });
    return {
      status,
      rules: evaluation.rules,
      awaitingMetrics: false,
    };
  }, [account, trades, daily, maxDd]);

  async function handleTrackChange(next) {
    if (!account?.id) return;
    const risk_track = next === '' || next == null ? null : normalizeRiskTrack(next);
    if (risk_track === normalizeRiskTrack(account.risk_track)) return;

    setBusy(true);
    setMsg(null);
    try {
      await updateTradingAccount(account.id, { risk_track });
      await refreshAccountRiskEligibility([account.id]);
      await onChanged?.();
      toast.success(
        risk_track
          ? `Risk track set to ${riskTrackLabel(risk_track)}`
          : 'Risk track cleared',
      );
    } catch (err) {
      setMsg(err.message || 'Could not update risk track.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className={sectionLabel}>Risk track</p>
        <StatusPill status={status} />
      </div>

      <div className="max-w-sm">
        <label className={label}>Master or EA</label>
        <CustomDropdown
          className="w-full"
          menuClassName="w-full"
          buttonClassName={formSelectBtn}
          value={trackValue}
          onChange={(v) => void handleTrackChange(v)}
          options={TRACK_OPTIONS}
          disabled={busy}
          placeholder="Not set"
          ariaLabel="Risk track"
        />
      </div>

      {msg ? <p className={`${msgError} mt-2`}>{msg}</p> : null}

      {status === 'unconfigured' ? (
        <p className="mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Choose Master or EA to auto-check eligibility from this account&apos;s journal history.
        </p>
      ) : awaitingMetrics || refreshing ? (
        <p className="mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Refreshing…
        </p>
      ) : rules.length ? (
        <ul className="mt-4 space-y-1" role="list" aria-label="SIAC Eligibility checklist">
          {rules.map((rule) => {
            const checked = rule.pass === true;
            const title = RULE_COPY[rule.id] || rule.id;
            return (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-2 text-sm"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <span
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950'
                        : 'border-zinc-300 bg-transparent dark:border-zinc-600'
                    }`}
                    aria-hidden="true"
                  >
                    {checked ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                          d="M2.5 6.2L4.8 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span
                    className={`font-medium ${
                      checked
                        ? 'text-zinc-800 dark:text-zinc-200'
                        : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {title}
                    <span className="sr-only">
                      {checked ? ' — met' : ' — not met'}
                    </span>
                  </span>
                </div>
                <span className="tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRuleActual(rule.id, rule.actual)}
                  <span className="mx-1 text-zinc-300 dark:text-zinc-600">/</span>
                  {formatRuleLimit(rule.id, rule.limit)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Auto-checked from journal history. Operational EA controls are not verified in v1.
      </p>
    </div>
  );
}
