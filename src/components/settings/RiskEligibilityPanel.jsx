// src/components/settings/RiskEligibilityPanel.jsx
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { refreshAccountRiskEligibility, updateTradingAccount } from '../../api';
import CustomDropdown from '../common/CustomDropdown';
import { RISK_TRACKS, normalizeRiskTrack, riskTrackLabel } from '../../lib/accounts';
import { evaluateRiskEligibility } from '../../lib/riskEligibility';
import {
  hasPersistedRiskSnapshot,
  needsRiskRefresh,
  resolveSiacStatus,
  rulesFromPersisted,
} from '../../lib/siacEligibilityUi';
import { label, msgError, sectionLabel, select } from '../../lib/ui';
import SiacChecklist, { SiacStatusPill } from './SiacChecklist';

const formSelectBtn = `${select} inline-flex items-center justify-between gap-2 text-left font-normal`;

const TRACK_OPTIONS = [
  { value: '', label: 'Not set' },
  ...RISK_TRACKS,
];

export default function RiskEligibilityPanel({
  account,
  trades = [],
  daily,
  maxDd = 0,
  onChanged,
  fill = false,
  header = null,
}) {
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState(null);

  const trackValue = normalizeRiskTrack(account?.risk_track) || '';
  const headerMode = Boolean(header);

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

    const status = resolveSiacStatus(account);

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

  const trackDropdown = (
    <CustomDropdown
      className={headerMode ? 'w-[9.5rem] sm:w-44' : 'w-full'}
      menuClassName="w-full"
      buttonClassName={formSelectBtn}
      value={trackValue}
      onChange={(v) => void handleTrackChange(v)}
      options={TRACK_OPTIONS}
      disabled={busy}
      placeholder="Not set"
      ariaLabel="Risk track"
    />
  );

  return (
    <div className={fill || headerMode ? 'flex h-full min-h-0 flex-col' : undefined}>
      {headerMode ? (
        <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {header}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {trackDropdown}
            <SiacStatusPill status={status} />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className={sectionLabel}>Risk track</p>
            <SiacStatusPill status={status} />
          </div>

          <div className={`shrink-0 ${fill ? 'max-w-md' : 'max-w-sm'}`}>
            <label className={label}>Master or EA</label>
            {trackDropdown}
          </div>
        </>
      )}

      {msg ? <p className={`${msgError} mt-2 shrink-0`}>{msg}</p> : null}

      {status === 'unconfigured' ? (
        <p className="mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Choose Master or EA to auto-check eligibility from this account&apos;s journal history.
        </p>
      ) : awaitingMetrics || refreshing ? (
        <p className="mt-4 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Refreshing…
        </p>
      ) : rules.length ? (
        <div className={fill || headerMode ? 'min-h-0 flex-1 overflow-y-auto' : 'mt-4'}>
          <SiacChecklist rules={rules} fill={fill || headerMode} />
        </div>
      ) : null}

      <p className={`text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 ${fill || headerMode ? 'mt-auto shrink-0 border-t border-zinc-100 pt-3 dark:border-zinc-800' : 'mt-4'}`}>
        Auto-checked from journal history. Operational EA controls are not verified in v1.
      </p>
    </div>
  );
}
