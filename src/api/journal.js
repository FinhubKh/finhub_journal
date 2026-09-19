import { SUPABASE_URL, getToken, getUserId, authHeaders, authFetch } from './auth';
import { toUsdPnl, normalizePnlDenomination } from '../lib/format';

/** Keep in sync with TRADE_SELECT in index.js — avoid a circular import. */
const TRADE_SELECT = [
  'id',
  'user_id',
  'created_at',
  'date',
  'result',
  'r_value',
  'pnl_usd',
  'notes',
  'session',
  'account',
  'account_id',
  'source',
  'ticket',
  'symbol',
  'direction',
  'entry_price',
  'exit_price',
  'lot_size',
  'open_time',
  'close_time',
].join(',');

export const TRADE_PAGE_SIZE = 50;

function parseContentRangeTotal(res) {
  const cr = res.headers.get('content-range') || '';
  const total = cr.split('/')[1];
  if (!total || total === '*') return null;
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

async function readError(res) {
  try {
    const body = await res.json();
    return body?.message || body?.hint || JSON.stringify(body);
  } catch {
    return res.statusText || 'Request failed';
  }
}

export async function fetchJournalBundle(accountId) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/get_my_journal_bundle`, {
    method: 'POST',
    headers: authHeaders(getToken()),
    body: JSON.stringify({ p_account_id: accountId || null }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data || {
    stats: null,
    daily: [],
    breakdown: { symbol: [], session: [], direction: [], outcome: [] },
    accounts: [],
  };
}

export async function fetchTradesPage({
  accountId,
  result,
  session,
  from,
  to,
  page = 1,
  pageSize = TRADE_PAGE_SIZE,
} = {}) {
  const uid = getUserId();
  const params = new URLSearchParams({
    select: TRADE_SELECT,
    order: 'date.desc,close_time.desc.nullslast,id.desc',
  });
  if (uid) params.set('user_id', `eq.${uid}`);
  if (accountId) params.set('account_id', `eq.${accountId}`);
  if (result) params.set('result', `eq.${result}`);
  if (session) params.set('session', `eq.${session}`);
  if (from && to) {
    params.set('and', `(date.gte.${from},date.lte.${to})`);
  } else if (from) {
    params.set('date', `gte.${from}`);
  } else if (to) {
    params.set('date', `lte.${to}`);
  }

  const fromIdx = Math.max(0, (page - 1) * pageSize);
  const toIdx = fromIdx + pageSize - 1;
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades?${params}`, {
    headers: {
      ...authHeaders(getToken()),
      Range: `${fromIdx}-${toIdx}`,
      Prefer: 'count=exact',
    },
  });
  if (res.status === 416) {
    return { trades: [], total: 0, page, pageSize };
  }
  if (!res.ok) throw new Error(await readError(res));
  const trades = await res.json();
  const total = parseContentRangeTotal(res) ?? (Array.isArray(trades) ? trades.length : 0);
  return { trades: Array.isArray(trades) ? trades : [], total, page, pageSize };
}

export async function fetchUnannotatedCount(accountId) {
  const uid = getUserId();
  const params = new URLSearchParams({
    select: 'id',
    source: 'eq.api',
    or: '(notes.is.null,notes.eq.)',
  });
  if (uid) params.set('user_id', `eq.${uid}`);
  if (accountId) params.set('account_id', `eq.${accountId}`);

  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades?${params}`, {
    headers: {
      ...authHeaders(getToken()),
      Range: '0-0',
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) return 0;
  return parseContentRangeTotal(res) || 0;
}

export async function fetchCashflows({ accountId, from, to, opType, page, pageSize } = {}) {
  const uid = getUserId();
  const paginate = page != null && pageSize != null;
  const params = new URLSearchParams({
    select: 'id,account_id,ticket,op_type,amount,comment,occurred_at,date,source',
    order: 'occurred_at.desc.nullslast,date.desc',
  });
  if (!paginate) params.set('limit', '500');
  if (uid) params.set('user_id', `eq.${uid}`);
  if (accountId) params.set('account_id', `eq.${accountId}`);
  if (opType) params.set('op_type', `eq.${opType}`);
  if (from && to) {
    params.set('and', `(date.gte.${from},date.lte.${to})`);
  } else if (from) {
    params.set('date', `gte.${from}`);
  } else if (to) {
    params.set('date', `lte.${to}`);
  }

  const headers = { ...authHeaders(getToken()) };
  if (paginate) {
    const fromIdx = Math.max(0, (page - 1) * pageSize);
    const toIdx = fromIdx + pageSize - 1;
    headers.Range = `${fromIdx}-${toIdx}`;
    headers.Prefer = 'count=exact';
  }

  const res = await authFetch(`${SUPABASE_URL}/rest/v1/account_cashflows?${params}`, { headers });
  if (res.status === 416) return { cashflows: [], total: 0 };
  if (!res.ok) return { cashflows: [], total: 0 };
  const rows = await res.json();
  const cashflows = Array.isArray(rows) ? rows : [];
  const total = parseContentRangeTotal(res) ?? cashflows.length;
  return { cashflows, total };
}

export async function fetchTradeExtremes(accountId, { accounts = [] } = {}) {
  const uid = getUserId();
  if (!uid) return { bestTrade: 0, worstTrade: 0 };

  const base = `${SUPABASE_URL}/rest/v1/trades?select=pnl_usd,account_id&user_id=eq.${uid}`;
  const acct = accountId ? `&account_id=eq.${accountId}` : '';
  // Portfolio may mix $ / ¢ accounts — pull a window then normalize to USD.
  const limit = accountId ? 1 : 50;

  try {
    const [bestRes, worstRes] = await Promise.all([
      authFetch(`${base}${acct}&order=pnl_usd.desc.nullslast&limit=${limit}`, {
        headers: authHeaders(getToken()),
      }),
      authFetch(`${base}${acct}&order=pnl_usd.asc.nullslast&limit=${limit}`, {
        headers: authHeaders(getToken()),
      }),
    ]);
    const bestRows = bestRes.ok ? await bestRes.json() : [];
    const worstRows = worstRes.ok ? await worstRes.json() : [];
    if (!Array.isArray(bestRows) && !Array.isArray(worstRows)) {
      return { bestTrade: 0, worstTrade: 0 };
    }

    const denomByAccount = new Map(
      (accounts || []).map((a) => [a.id, normalizePnlDenomination(a.pnl_denomination)]),
    );

    const toView = (row) => {
      const raw = Number(row?.pnl_usd);
      if (!Number.isFinite(raw)) return null;
      // Single-account view: values are already in that account's units.
      if (accountId) return raw;
      const denom = denomByAccount.get(row.account_id) || 'usd';
      return toUsdPnl(raw, denom);
    };

    let bestTrade = 0;
    for (const row of bestRows || []) {
      const v = toView(row);
      if (v != null && v > bestTrade) bestTrade = v;
    }
    let worstTrade = 0;
    for (const row of worstRows || []) {
      const v = toView(row);
      if (v != null && v < worstTrade) worstTrade = v;
    }

    return { bestTrade, worstTrade };
  } catch {
    return { bestTrade: 0, worstTrade: 0 };
  }
}
