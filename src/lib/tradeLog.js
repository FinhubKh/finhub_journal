export const CASHFLOW_RESULTS = new Set(['deposit', 'withdrawal']);
export const TRADE_RESULTS = new Set(['win', 'loss', 'be']);

/** Newest activity first: close time for trades, occurred_at for cashflows. */
export function rowSortTs(row) {
  const raw = row?.close_time || row?.occurred_at;
  const ms = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(ms)) return ms;
  if (row?.date) {
    const day = Date.parse(`${row.date}T00:00:00Z`);
    return Number.isFinite(day) ? day : 0;
  }
  const created = row?.created_at ? Date.parse(row.created_at) : NaN;
  return Number.isFinite(created) ? created : 0;
}

export function compareRowsNewestFirst(a, b) {
  const diff = rowSortTs(b) - rowSortTs(a);
  if (diff !== 0) return diff;
  return String(b?.id || '').localeCompare(String(a?.id || ''));
}

export function cashflowToRow(c) {
  return {
    id: `cash-${c.id}`,
    date: c.date,
    occurred_at: c.occurred_at,
    close_time: c.occurred_at || (c.date ? `${c.date}T00:00:00Z` : null),
    symbol: null,
    direction: null,
    lot_size: null,
    result: c.op_type,
    r_value: null,
    pnl_usd: c.amount,
    session: null,
    notes: c.comment,
    account_id: c.account_id,
    source: c.source,
    ticket: c.ticket,
    isCashflow: true,
  };
}

export function mergeCashflowsIntoPage(trades, cashflows, { pageSafe, totalPages, hideCash, cashOnly } = {}) {
  if (cashOnly) {
    return (cashflows || []).map(cashflowToRow).sort(compareRowsNewestFirst);
  }
  if (hideCash || !cashflows?.length) {
    return [...(trades || [])].sort(compareRowsNewestFirst);
  }
  const rows = cashflows.map(cashflowToRow);
  if (!trades?.length) return pageSafe === 1 ? rows.sort(compareRowsNewestFirst) : [];
  const newest = trades[0]?.date;
  const oldest = trades[trades.length - 1]?.date;
  const extra = rows.filter((c) => {
    if (c.date >= oldest && c.date <= newest) return true;
    if (pageSafe === 1 && c.date > newest) return true;
    if (pageSafe === totalPages && c.date < oldest) return true;
    return false;
  });
  return [...trades, ...extra].sort(compareRowsNewestFirst);
}
