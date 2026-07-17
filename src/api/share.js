import { SUPABASE_URL, SUPABASE_ANON_KEY, authHeaders, getToken, authFetch } from './auth';

function shareUrlForToken(token) {
  if (!token || typeof window === 'undefined') return '';
  return `${window.location.origin}/share/${token}`;
}

export function getAccountShareUrl(account) {
  if (!account?.is_public || !account?.share_token) return '';
  return shareUrlForToken(account.share_token);
}

/** Publish or unpublish a trading account. Returns updated account row. */
export async function setTradingAccountPublic(accountId, isPublic) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/set_trading_account_public`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ p_account_id: accountId, p_is_public: Boolean(isPublic) }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/** Rotate share token for a published account. Invalidates the old public URL. */
export async function regenerateTradingAccountShareToken(accountId) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/regenerate_trading_account_share_token`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ p_account_id: accountId }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Load a published account + trades for the public share page.
 * Works for anonymous visitors (uses anon key when no session).
 * Notes are never returned. Trades are hard-capped server-side (latest first).
 */
export async function fetchPublishedTradingAccount(token, opts = {}) {
  const clean = String(token || '').trim();
  if (!clean) return null;

  const limit = Number.isFinite(opts.limit) ? opts.limit : 1000;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_published_trading_account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ p_token: clean, p_limit: limit }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (!data || !data.account) return null;

  const trades = Array.isArray(data.trades) ? data.trades : [];
  const tradeCount = Number.isFinite(data.trade_count) ? data.trade_count : trades.length;

  return {
    account: data.account,
    owner: data.owner || { display_name: 'Trader' },
    trades,
    tradeCount,
    tradesReturned: Number.isFinite(data.trades_returned) ? data.trades_returned : trades.length,
    tradesCapped: Boolean(data.trades_capped),
    shareUrl: shareUrlForToken(data.account.share_token),
  };
}

/**
 * Ranked list of published trading accounts (anon-safe).
 * @param {{ limit?: number, minTrades?: number }} [opts]
 */
export async function fetchPublicLeaderboard(opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : 50;
  const minTrades = Number.isFinite(opts.minTrades) ? opts.minTrades : 5;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_leaderboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ p_limit: limit, p_min_trades: minTrades }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return {
    entries: entries.map((e, i) => ({
      rank: e.rank_pnl ?? i + 1,
      accountId: e.account_id,
      accountName: e.account_name,
      shareToken: e.share_token,
      shareUrl: shareUrlForToken(e.share_token),
      accountType: e.account_type,
      pnlDenomination: e.pnl_denomination,
      color: e.color,
      publishedAt: e.published_at,
      displayName: e.display_name || 'Trader',
      tradeCount: Number(e.trade_count) || 0,
      wins: Number(e.wins) || 0,
      losses: Number(e.losses) || 0,
      totalPnl: Number(e.total_pnl) || 0,
      winRate: Number(e.win_rate) || 0,
      profitFactor: e.profit_factor_infinite ? Infinity : (e.profit_factor == null ? null : Number(e.profit_factor)),
    })),
    minTrades: data?.min_trades ?? minTrades,
    limit: data?.limit ?? limit,
  };
}
