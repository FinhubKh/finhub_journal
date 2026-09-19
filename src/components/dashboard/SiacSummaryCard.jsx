import { useEffect, useMemo, useState } from 'react';
import { refreshAccountRiskEligibility } from '../../api';
import { normalizeRiskTrack, riskTrackLabel } from '../../lib/accounts';
import {
  hasPersistedRiskSnapshot,
  needsRiskRefresh,
  resolveSiacStatus,
  rulesFromPersisted,
} from '../../lib/siacEligibilityUi';
import { card } from '../../lib/ui';
import SiacChecklist, { SiacStatusPill } from '../settings/SiacChecklist';
import SiacLogo from '../common/SiacLogo';

/**
 * Compact SIAC eligibility card for Overview (Home) Summary.
 * - Single account: checklist + status
 * - Portfolio (`accounts`): per-account status list
 * Pass `fill` when placed in a split layout so the card matches the Equity column height.
 */
export default function SiacSummaryCard({
  account,
  accounts,
  onSelectAccount,
  onChanged,
  fill = false,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const isPortfolio = Array.isArray(accounts);

  const refreshKey = isPortfolio
    ? (accounts || []).map((a) => `${a.id}:${a.risk_track || ''}:${a.risk_checked_at || ''}`).join('|')
    : `${account?.id || ''}:${account?.risk_track || ''}:${account?.risk_checked_at || ''}`;

  useEffect(() => {
    const targets = isPortfolio
      ? (accounts || []).filter((a) => needsRiskRefresh(a))
      : account && needsRiskRefresh(account)
        ? [account]
        : [];

    if (!targets.length) return undefined;

    let cancelled = false;
    setRefreshing(true);

    (async () => {
      try {
        await refreshAccountRiskEligibility(targets.map((a) => a.id));
        if (!cancelled) await onChanged?.();
      } catch {
        // Summary stays read-only; full SIAC tab / account detail surfaces errors.
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // refreshKey captures id/track/checked_at for the account(s) in view.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional snapshot key
  }, [refreshKey]);

  const { status, rules, awaitingMetrics } = useMemo(() => {
    if (isPortfolio || !account) {
      return { status: 'unconfigured', rules: [], awaitingMetrics: false };
    }
    const track = normalizeRiskTrack(account.risk_track);
    if (!track) {
      return { status: 'unconfigured', rules: [], awaitingMetrics: false };
    }
    const nextStatus = resolveSiacStatus(account);
    if (hasPersistedRiskSnapshot(account)) {
      return {
        status: nextStatus,
        rules: rulesFromPersisted(account, track),
        awaitingMetrics: false,
      };
    }
    return { status: nextStatus, rules: [], awaitingMetrics: true };
  }, [account, isPortfolio]);

  const portfolioRows = useMemo(() => {
    if (!isPortfolio) return [];
    return [...accounts]
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map((row) => ({
        account: row,
        status: resolveSiacStatus(row),
        track: riskTrackLabel(row.risk_track),
      }));
  }, [accounts, isPortfolio]);

  return (
    <section
      aria-label="SIAC Eligibility"
      className={`${card} px-3 py-3 md:px-4 ${
        fill ? 'flex h-full min-h-0 flex-col' : 'shrink-0'
      }`}
    >
      <div className="mb-2.5 flex shrink-0 items-center gap-2.5">
        <SiacLogo size={28} />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            SIAC Eligibility
          </h2>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {isPortfolio ? 'Status across your accounts' : 'Checked from this account’s history'}
          </p>
        </div>
      </div>

      <div className={fill ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
        {isPortfolio ? (
          portfolioRows.length === 0 ? (
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Add a trading account to track Master / EA eligibility.
            </p>
          ) : refreshing ? (
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Refreshing…
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" role="list">
              {portfolioRows.map(({ account: row, status: rowStatus, track }) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50"
                    onClick={() => onSelectAccount?.(row.id)}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color || '#a1a1aa' }}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {row.name}
                        </span>
                      </div>
                      <p className="mt-0.5 pl-4 text-xs text-zinc-500 dark:text-zinc-400">{track}</p>
                    </div>
                    <SiacStatusPill status={rowStatus} />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : status === 'unconfigured' ? (
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
    </section>
  );
}
