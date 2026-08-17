import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useTradeModal } from '../../context/TradeModalContext';
import { useDialog } from '../../context/DialogContext';
import { deleteTrade, fetchTradesPage, fetchUnannotatedCount, TRADE_PAGE_SIZE } from '../../api';
import { fmtR, fmtDateShort, capitalize, fmtPnlStrict, fmtLot } from '../../lib/format';
import { tradePnlDenomination } from '../../lib/accounts';
import {
  btnGhost, btnDanger, btnSm, btnPrimary, cardTitle, emptyState, tradeResultBadge,
} from '../../lib/ui';
import CustomDropdown from '../common/CustomDropdown';
import SyncNowButton from '../common/SyncNowButton';
import AccountViewDropdown from '../layout/AccountViewDropdown';
import ManualTradeModal from '../modals/ManualTradeModal';

const EMPTY_FILTERS = { result: '', session: '', from: '', to: '' };
const PAGE_SIZE = TRADE_PAGE_SIZE;

const filterControl =
  'h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50';

const th =
  'sticky top-0 z-10 whitespace-nowrap bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shadow-[inset_0_-1px_0_0_rgb(228_228_231)] dark:shadow-[inset_0_-1px_0_0_rgb(39_39_42)]';
const td = 'whitespace-nowrap px-4 py-3.5 text-sm text-zinc-700 dark:text-zinc-300';
const tdNum = `${td} text-right font-medium tabular-nums`;

function FilterField({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

export default function TradeList() {
  const {
    viewMode,
    activeAccount,
    activeAccountId,
    tradingAccounts,
    setViewMode,
    setActiveAccountId,
    resolveTradeAccount,
    refreshTrades,
    tradesEpoch,
    journalStats,
  } = useAppData();
  const { open } = useTradeModal();
  const { alert, confirm } = useDialog();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const [pageTrades, setPageTrades] = useState([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [unannotatedCount, setUnannotatedCount] = useState(0);

  function setFilter(key, value) { setFilters((f) => ({ ...f, [key]: value })); }
  function clearFilters() { setFilters(EMPTY_FILTERS); }

  const accountSwitchValue = viewMode === 'portfolio' ? 'portfolio' : (activeAccount?.id || '');

  const accountSwitchOptions = useMemo(
    () => [
      { value: 'portfolio', label: 'All accounts' },
      ...tradingAccounts.map((a) => ({ value: a.id, label: a.name })),
    ],
    [tradingAccounts],
  );

  function handleAccountSwitch(value) {
    if (value === 'portfolio') {
      setViewMode('portfolio');
      return;
    }
    setActiveAccountId(value);
  }

  const scopedAccountId = viewMode === 'account' ? (activeAccountId || activeAccount?.id || '') : '';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [filters, viewMode, scopedAccountId]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        const { trades, total: nextTotal } = await fetchTradesPage({
          accountId: scopedAccountId || undefined,
          result: filters.result || undefined,
          session: filters.session || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          page: pageSafe,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;
        setPageTrades(trades);
        setTotal(nextTotal);
      } catch {
        if (!cancelled) {
          setPageTrades([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters, scopedAccountId, pageSafe, tradesEpoch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const count = await fetchUnannotatedCount(scopedAccountId || undefined);
        if (!cancelled) setUnannotatedCount(count);
      } catch {
        if (!cancelled) setUnannotatedCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [scopedAccountId, tradesEpoch]);

  const hasFilters = Object.values(filters).some((v) => v !== '');
  const unfilteredTotal = journalStats?.total || 0;

  async function confirmDelete(id, e) {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete trade?',
      message: 'This trade will be removed from your journal permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTrade(id);
      await refreshTrades();
    } catch {
      await alert({ title: 'Error', message: 'Could not delete trade.' });
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3.5 md:px-6 dark:border-zinc-800">
        <div>
          <h3 className={`${cardTitle} flex items-center gap-2`}>
            Trade History
            {unannotatedCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {unannotatedCount} need review
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {viewMode === 'portfolio'
              ? 'All accounts'
              : activeAccount?.name || 'Account'}
            {' · '}
            {total} trade{total === 1 ? '' : 's'}
            {hasFilters && unfilteredTotal > 0 ? ` · filtered from ${unfilteredTotal}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AccountViewDropdown variant="header" />
          <SyncNowButton size="sm" />
          <button className={btnPrimary} type="button" onClick={() => setManualOpen(true)}>
            Log trade
          </button>
        </div>
      </div>

      <div className="relative z-20 shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 px-4 py-3 md:px-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <FilterField label="Result">
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              buttonClassName={`${filterControl} inline-flex items-center justify-between gap-2 text-left hover:border-violet-300`}
              value={filters.result}
              onChange={(v) => setFilter('result', v)}
              options={[
                { value: '', label: 'All results' },
                { value: 'win', label: 'Win' },
                { value: 'loss', label: 'Loss' },
                { value: 'be', label: 'BE' },
              ]}
            />
          </FilterField>
          <FilterField label="Session">
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              buttonClassName={`${filterControl} inline-flex items-center justify-between gap-2 text-left hover:border-violet-300`}
              value={filters.session}
              onChange={(v) => setFilter('session', v)}
              options={[
                { value: '', label: 'All sessions' },
                { value: 'asian', label: 'Asian' },
                { value: 'london', label: 'London' },
                { value: 'ny', label: 'New York' },
              ]}
            />
          </FilterField>
          <FilterField label="Account">
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              buttonClassName={`${filterControl} inline-flex items-center justify-between gap-2 text-left hover:border-violet-300`}
              value={accountSwitchValue}
              onChange={handleAccountSwitch}
              options={accountSwitchOptions}
            />
          </FilterField>
          <FilterField label="From">
            <input
              className={filterControl}
              type="date"
              value={filters.from}
              onChange={(e) => setFilter('from', e.target.value)}
            />
          </FilterField>
          <FilterField label="To">
            <input
              className={filterControl}
              type="date"
              value={filters.to}
              onChange={(e) => setFilter('to', e.target.value)}
            />
          </FilterField>
          <div className="col-span-2 flex items-end sm:col-span-1 xl:col-span-1">
            <button
              className={`${btnGhost} h-9 w-full disabled:opacity-45`}
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {listLoading && total === 0 ? (
          <div className={`${emptyState} min-h-0 flex-1`}>Loading trades…</div>
        ) : total === 0 ? (
          <div className={`${emptyState} min-h-0 flex-1`}>
            {hasFilters || unfilteredTotal > 0 ? 'No trades match your filters.' : 'No trades yet. Log a manual trade or sync from MT5.'}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Symbol</th>
                  <th className={th}>Side</th>
                  <th className={`${th} text-right`}>Lot</th>
                  <th className={th}>Account</th>
                  <th className={th}>Result</th>
                  <th className={`${th} text-right`}>R</th>
                  <th className={`${th} text-right`}>PnL</th>
                  <th className={th}>Session</th>
                  <th className={`${th} min-w-[180px]`}>Notes</th>
                  <th className={`${th} w-16 text-right`} aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {pageTrades.map((t) => {
                  const isApi = t.source === 'api';
                  const needsReview = isApi && !t.notes;
                  const rDisplay = fmtR(t.r_value) || '—';
                  const denom = tradePnlDenomination(t, resolveTradeAccount);
                  const pnlDisplay = fmtPnlStrict(t.pnl_usd, denom);
                  const accountName = resolveTradeAccount(t)?.name || t.account || '—';
                  const pnlTone = (t.pnl_usd || 0) >= 0 ? 'text-violet-600' : 'text-rose-600';
                  const rTone = t.result === 'win' ? 'text-violet-600' : t.result === 'loss' ? 'text-rose-600' : 'text-amber-600';

                  return (
                    <tr
                      key={t.id}
                      className="cursor-pointer transition hover:bg-violet-50/40"
                      onClick={() => open(t)}
                    >
                      <td className={`${td} font-medium text-zinc-900`}>{fmtDateShort(t.date)}</td>
                      <td className={`${td} font-semibold text-zinc-900`}>{t.symbol || '—'}</td>
                      <td className={td}>
                        {t.direction ? (
                          <span className="uppercase text-xs font-semibold text-zinc-500">{t.direction}</span>
                        ) : '—'}
                      </td>
                      <td className={tdNum}>{fmtLot(t.lot_size)}</td>
                      <td className={td}>
                        <span className="max-w-[140px] truncate block text-zinc-600">{accountName}</span>
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className={tradeResultBadge(t.result)}>{t.result}</span>
                          {needsReview && (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Review
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={`${tdNum} ${rTone}`}>{rDisplay}</td>
                      <td className={`${tdNum} ${pnlTone}`}>{pnlDisplay}</td>
                      <td className={td}>{t.session ? capitalize(t.session) : '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-zinc-500">
                        <span className="line-clamp-2 max-w-[220px]">{t.notes || '—'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {!isApi && (
                          <button
                            className={btnDanger}
                            type="button"
                            onClick={(e) => confirmDelete(t.id, e)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90 px-4 py-3 md:px-5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {total > PAGE_SIZE
                ? `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, total)} of ${total}`
                : `${total} trade${total === 1 ? '' : 's'}`}
            </span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  className={btnSm}
                  type="button"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="min-w-[88px] text-center text-xs font-medium text-zinc-600">
                  Page {pageSafe} / {totalPages}
                </span>
                <button
                  className={btnSm}
                  type="button"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ManualTradeModal isOpen={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
