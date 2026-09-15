import { useEffect, useMemo, useState } from 'react';
import { refreshAccountRiskEligibility } from '../../api';
import { normalizeRiskTrack } from '../../lib/accounts';
import {
  hasPersistedRiskSnapshot,
  needsRiskRefresh,
  resolveSiacStatus,
  rulesFromPersisted,
} from '../../lib/siacEligibilityUi';
import { btnOutline, card, sectionLabel } from '../../lib/ui';
import SiacChecklist, { SiacStatusPill } from '../settings/SiacChecklist';

/**
 * Compact read-only SIAC eligibility card for Overview Summary.
 * Pass `fill` when placed in a split layout so the card matches the Equity column height.
 */
export default function SiacSummaryCard({ account, onManage, onChanged, fill = false }) {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!needsRiskRefresh(account)) return undefined;

    let cancelled = false;
    setRefreshing(true);

    (async () => {
      try {
        await refreshAccountRiskEligibility([account.id]);
        if (!cancelled) await onChanged?.();
      } catch {
        // Summary stays read-only; full SIAC tab surfaces errors.
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
    if (!track) {
      return { status: 'unconfigured', rules: [], awaitingMetrics: false };
    }
    const status = resolveSiacStatus(account);
    if (hasPersistedRiskSnapshot(account)) {
      return {
        status,
        rules: rulesFromPersisted(account, track),
        awaitingMetrics: false,
      };
    }
    return { status, rules: [], awaitingMetrics: true };
  }, [account]);

  return (
    <section
      aria-labelledby="summary-siac-heading"
      className={`${card} px-4 py-4 md:px-5 ${
        fill ? 'flex h-full min-h-0 flex-col' : 'shrink-0'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <h2
            id="summary-siac-heading"
            className="mt-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            SIAC Eligibility
          </h2>
        </div>
        <SiacStatusPill status={status} />
      </div>

      <div className={fill ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
        {status === 'unconfigured' ? (
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Choose Master or EA to auto-check eligibility from this account&apos;s journal history.
          </p>
        ) : awaitingMetrics || refreshing ? (
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Refreshing…
          </p>
        ) : (
          <SiacChecklist rules={rules} />
        )}
      </div>

      {typeof onManage === 'function' ? (
        <div className="mt-4 shrink-0">
          <button type="button" className={btnOutline} onClick={onManage}>
            Manage SIAC
          </button>
        </div>
      ) : null}
    </section>
  );
}
