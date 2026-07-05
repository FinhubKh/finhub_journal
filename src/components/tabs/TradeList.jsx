import { useMemo, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useTradeModal } from '../../context/TradeModalContext';
import { deleteTrade } from '../../lib/api';
import { fmtR, fmtDateShort } from '../../lib/format';

function fmtPnlStrict(v) {
  if (!v) return '';
  return v > 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

const EMPTY_FILTERS = { result: '', session: '', model: '', account: '', from: '', to: '' };

export default function TradeList() {
  const { accountTrades, userModels, refreshTrades } = useAppData();
  const { open } = useTradeModal();
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  function setFilter(key, value) { setFilters((f) => ({ ...f, [key]: value })); }
  function clearFilters() { setFilters(EMPTY_FILTERS); }

  const filtered = useMemo(() => {
    let list = accountTrades;
    if (filters.result) list = list.filter((t) => t.result === filters.result);
    if (filters.session) list = list.filter((t) => t.session === filters.session);
    if (filters.model) list = list.filter((t) => t.model === filters.model);
    if (filters.account) list = list.filter((t) => (t.account || '').toLowerCase() === filters.account.toLowerCase());
    if (filters.from) list = list.filter((t) => t.date >= filters.from);
    if (filters.to) list = list.filter((t) => t.date <= filters.to);
    return list;
  }, [accountTrades, filters]);

  const hasFilters = Object.values(filters).some((v) => v !== '');
  const unannotatedCount = accountTrades.filter((t) => t.source === 'api' && !t.notes && !t.model).length;

  async function confirmDelete(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this trade?')) return;
    try { await deleteTrade(id); await refreshTrades(); }
    catch (err) { alert('Could not delete trade.'); }
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="card-hd">
        <h3 className="card-title">
          Trade History
          {unannotatedCount > 0 && <span className="review-count-badge">{unannotatedCount}</span>}
        </h3>
        <button className="text-btn" type="button" onClick={refreshTrades}>↻ Refresh</button>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={filters.result} onChange={(e) => setFilter('result', e.target.value)}>
          <option value="">All Results</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="be">BE</option>
        </select>
        <select className="filter-select" value={filters.session} onChange={(e) => setFilter('session', e.target.value)}>
          <option value="">All Sessions</option>
          <option value="asian">Asian</option>
          <option value="london">London</option>
          <option value="ny">New York</option>
        </select>
        <select className="filter-select" value={filters.model} onChange={(e) => setFilter('model', e.target.value)}>
          <option value="">All Models</option>
          {userModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        <input className="filter-input-date" type="text" placeholder="Account..." style={{ maxWidth: 100 }}
          value={filters.account} onChange={(e) => setFilter('account', e.target.value)} />
        <input className="filter-input-date" type="date" title="From date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        <input className="filter-input-date" type="date" title="To date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        <button className="filter-clear-btn" type="button" onClick={clearFilters}>✕ Clear</button>
        <span className="filter-count">{hasFilters ? `${filtered.length} of ${accountTrades.length}` : ''}</span>
      </div>

      <div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            {accountTrades.length === 0 ? 'No trades yet. Log your first trade above.' : 'No trades match your filters.'}
          </div>
        ) : (
          filtered.slice(0, 100).map((t) => {
            const isApi = t.source === 'api';
            const needsReview = isApi && !t.notes && !t.model;
            const rDisplay = fmtR(t.r_value);
            const pnlDisplay = fmtPnlStrict(t.pnl_usd);
            return (
              <div className="trade-row" key={t.id} onClick={() => open(t)}>
                <div className="trade-row-left">
                  <div className="trade-row-top">
                    <span className={`trade-result ${t.result}`}>{t.result.toUpperCase()}</span>
                    <span className="trade-date">{fmtDateShort(t.date)}</span>
                    {isApi && <span className="trade-tag source-tag" title="Synced from MT4/5">🔒 {t.symbol || 'MT'}</span>}
                    {needsReview && <span className="trade-tag review-tag">Needs review</span>}
                    {t.account && <span className="trade-tag account-tag">{t.account}</span>}
                    {t.model && <span className="trade-tag">{t.model}</span>}
                    {t.session && <span className="trade-tag">{t.session}</span>}
                  </div>
                  {t.notes && <p className="trade-notes">{t.notes}</p>}
                </div>
                <div className="trade-row-right">
                  <div className="trade-values">
                    {rDisplay && <span className={`trade-r ${t.result}`}>{rDisplay}</span>}
                    {pnlDisplay && <span className={`trade-pnl ${t.pnl_usd >= 0 ? 'win' : 'loss'}`}>{pnlDisplay}</span>}
                  </div>
                  {!isApi && (
                    <button className="delete-btn" type="button" onClick={(e) => confirmDelete(t.id, e)}>✕</button>
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
