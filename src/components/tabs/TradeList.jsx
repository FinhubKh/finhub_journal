import { useMemo, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useTradeModal } from '../../context/TradeModalContext';
import { useDialog } from '../../context/DialogContext';
import { deleteTrade } from '../../api';
import { fmtR, fmtDateShort } from '../../lib/format';
import {
  btnGhost, btnDanger, card, cardHd, cardTitle, emptyState, input, tradeResultBadge,
} from '../../lib/ui';

function fmtPnlStrict(v) {
  if (!v) return '';
  return v > 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

const EMPTY_FILTERS = { result: '', session: '', model: '', account: '', from: '', to: '' };

const filterSelect = `${input} py-2 text-xs sm:max-w-[140px]`;

export default function TradeList() {
  const { visibleTrades, viewMode, userModels, resolveTradeAccount, refreshTrades } = useAppData();
  const { open } = useTradeModal();
  const { alert, confirm } = useDialog();
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  function setFilter(key, value) { setFilters((f) => ({ ...f, [key]: value })); }
  function clearFilters() { setFilters(EMPTY_FILTERS); }

  const filtered = useMemo(() => {
    let list = visibleTrades;
    if (filters.result) list = list.filter((t) => t.result === filters.result);
    if (filters.session) list = list.filter((t) => t.session === filters.session);
    if (filters.model) list = list.filter((t) => t.model === filters.model);
    if (viewMode === 'portfolio' && filters.account) {
      list = list.filter((t) => {
        const acc = resolveTradeAccount(t);
        const q = filters.account.toLowerCase();
        return (acc?.name || t.account || '').toLowerCase().includes(q);
      });
    }
    if (filters.from) list = list.filter((t) => t.date >= filters.from);
    if (filters.to) list = list.filter((t) => t.date <= filters.to);
    return list;
  }, [visibleTrades, filters, viewMode, resolveTradeAccount]);

  const hasFilters = Object.entries(filters).some(([k, v]) => v !== '' && !(k === 'account' && viewMode !== 'portfolio'));
  const unannotatedCount = visibleTrades.filter((t) => t.source === 'api' && !t.notes && !t.model).length;

  async function confirmDelete(id, e) {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete trade?',
      message: 'This trade will be removed from your journal permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteTrade(id); await refreshTrades(); }
    catch (err) {
      await alert({ title: 'Error', message: 'Could not delete trade.' });
    }
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <h3 className={`${cardTitle} flex items-center gap-2`}>
          Trade History
          {unannotatedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {unannotatedCount}
            </span>
          )}
        </h3>
        <button className={btnGhost} type="button" onClick={refreshTrades}>Refresh</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3 md:px-5">
        <select className={filterSelect} value={filters.result} onChange={(e) => setFilter('result', e.target.value)}>
          <option value="">All Results</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="be">BE</option>
        </select>
        <select className={filterSelect} value={filters.session} onChange={(e) => setFilter('session', e.target.value)}>
          <option value="">All Sessions</option>
          <option value="asian">Asian</option>
          <option value="london">London</option>
          <option value="ny">New York</option>
        </select>
        <select className={filterSelect} value={filters.model} onChange={(e) => setFilter('model', e.target.value)}>
          <option value="">All Models</option>
          {userModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        <input className={`${input} max-w-[100px] py-2 text-xs`} type="text" placeholder="Account..."
          value={filters.account} onChange={(e) => setFilter('account', e.target.value)}
          disabled={viewMode !== 'portfolio'} />
        <input className={`${input} max-w-[140px] py-2 text-xs`} type="date" title="From date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        <input className={`${input} max-w-[140px] py-2 text-xs`} type="date" title="To date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        <button className={btnGhost} type="button" onClick={clearFilters}>Clear</button>
        {hasFilters && <span className="text-xs text-zinc-400">{filtered.length} of {visibleTrades.length}</span>}
      </div>

      <div className="divide-y divide-zinc-100">
        {filtered.length === 0 ? (
          <div className={emptyState}>
            {visibleTrades.length === 0 ? 'No trades yet. Log your first trade above.' : 'No trades match your filters.'}
          </div>
        ) : (
          filtered.slice(0, 100).map((t) => {
            const isApi = t.source === 'api';
            const needsReview = isApi && !t.notes && !t.model;
            const rDisplay = fmtR(t.r_value);
            const pnlDisplay = fmtPnlStrict(t.pnl_usd);
            return (
              <div
                key={t.id}
                className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 transition hover:bg-zinc-50 md:px-5"
                onClick={() => open(t)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={tradeResultBadge(t.result)}>{t.result}</span>
                    <span className="text-xs text-zinc-500">{fmtDateShort(t.date)}</span>
                    {isApi && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{t.symbol || 'MT'}</span>}
                    {needsReview && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Needs review</span>}
                    {(resolveTradeAccount(t)?.name || t.account) && (
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                        {resolveTradeAccount(t)?.name || t.account}
                      </span>
                    )}
                    {t.model && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t.model}</span>}
                    {t.session && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t.session}</span>}
                  </div>
                  {t.notes && <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{t.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right text-xs">
                    {rDisplay && <div className={t.result === 'win' ? 'font-medium text-violet-600' : t.result === 'loss' ? 'font-medium text-rose-600' : 'font-medium text-amber-600'}>{rDisplay}</div>}
                    {pnlDisplay && <div className={t.pnl_usd >= 0 ? 'text-violet-600' : 'text-rose-600'}>{pnlDisplay}</div>}
                  </div>
                  {!isApi && (
                    <button
                      className={btnDanger}
                      type="button"
                      onClick={(e) => confirmDelete(t.id, e)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
