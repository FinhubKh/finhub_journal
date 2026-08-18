import { SUPABASE_URL, authHeaders, getToken, getUserId, authFetch } from './auth';

const BACKTEST_SELECT = [
  'id',
  'user_id',
  'name',
  'currency',
  'report_symbol',
  'range_from',
  'range_to',
  'total_pnl',
  'trade_count',
  'wins',
  'losses',
  'be_count',
  'profit_factor',
  'is_public',
  'share_token',
  'published_at',
  'source_html',
  'created_at',
].join(',');

const DAILY_SELECT = [
  'id',
  'backtest_id',
  'date',
  'pnl_usd',
  'trade_count',
  'wins',
  'losses',
  'be_count',
].join(',');

const DAILY_CHUNK = 200;

async function restError(res, fallback) {
  let msg = fallback;
  try {
    const body = await res.json();
    msg = body?.message || body?.hint || body?.details || JSON.stringify(body);
  } catch {
    try {
      msg = (await res.text()) || fallback;
    } catch {
      /* keep fallback */
    }
  }
  return new Error(msg);
}

export async function listBacktests() {
  const uid = getUserId();
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/strategy_backtests?select=${BACKTEST_SELECT}&user_id=eq.${uid}&order=created_at.desc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw await restError(res, 'Could not load backtests.');
  }
  return res.json();
}

export async function fetchBacktestDaily(backtestId) {
  const uid = getUserId();
  const out = [];
  let from = 0;
  for (;;) {
    const to = from + 999;
    const res = await authFetch(
      `${SUPABASE_URL}/rest/v1/strategy_backtest_daily?select=${DAILY_SELECT}&user_id=eq.${uid}&backtest_id=eq.${backtestId}&order=date.asc`,
      {
        headers: {
          ...authHeaders(getToken()),
          Range: `${from}-${to}`,
        },
      },
    );
    if (!res.ok) {
      if (res.status === 404) return [];
      throw await restError(res, 'Could not load backtest days.');
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  return out;
}

export async function createBacktest({ name, currency, reportMeta, dailyRows }) {
  const uid = getUserId();
  const parent = {
    user_id: uid,
    name: String(name || 'Strategy backtest').trim() || 'Strategy backtest',
    currency: currency === 'cent' ? 'cent' : 'usd',
    report_symbol: reportMeta?.symbol || null,
    range_from: reportMeta?.rangeFrom || null,
    range_to: reportMeta?.rangeTo || null,
    total_pnl: Number(reportMeta?.totalPnl) || 0,
    trade_count: Number(reportMeta?.tradeCount) || 0,
    wins: Number(reportMeta?.wins) || 0,
    losses: Number(reportMeta?.losses) || 0,
    be_count: Number(reportMeta?.beCount) || 0,
    profit_factor: reportMeta?.profitFactorInfinite ? null : (Number(reportMeta?.profitFactor) || null),
    source_html: JSON.stringify(reportMeta?.breakdown || { symbol: [], session: [] }),
  };

  const createdRes = await authFetch(`${SUPABASE_URL}/rest/v1/strategy_backtests`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(parent),
  });
  if (!createdRes.ok) throw await restError(createdRes, 'Could not save backtest.');
  const createdRows = await createdRes.json();
  const backtest = Array.isArray(createdRows) ? createdRows[0] : createdRows;
  if (!backtest?.id) throw new Error('Could not save backtest.');

  const rows = (dailyRows || []).map((d) => ({
    user_id: uid,
    backtest_id: backtest.id,
    date: d.date,
    pnl_usd: Math.round((Number(d.pnl_usd) || 0) * 100) / 100,
    trade_count: Number(d.trade_count) || 0,
    wins: Number(d.wins) || 0,
    losses: Number(d.losses) || 0,
    be_count: Number(d.be_count) || 0,
  }));

  try {
    for (let i = 0; i < rows.length; i += DAILY_CHUNK) {
      const chunk = rows.slice(i, i + DAILY_CHUNK);
      const res = await authFetch(
        `${SUPABASE_URL}/rest/v1/strategy_backtest_daily?on_conflict=backtest_id,date`,
        {
          method: 'POST',
          headers: { ...authHeaders(getToken()), Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(chunk),
        },
      );
      if (!res.ok) throw await restError(res, 'Could not save backtest days.');
    }
  } catch (err) {
    await authFetch(
      `${SUPABASE_URL}/rest/v1/strategy_backtests?id=eq.${backtest.id}&user_id=eq.${uid}`,
      { method: 'DELETE', headers: authHeaders(getToken()) },
    );
    throw err;
  }

  return backtest;
}

export async function fetchBacktest(backtestId) {
  const uid = getUserId();
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/strategy_backtests?select=${BACKTEST_SELECT}&user_id=eq.${uid}&id=eq.${backtestId}&limit=1`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw await restError(res, 'Could not load backtest.');
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function deleteBacktestDaily(backtestId) {
  const uid = getUserId();
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/strategy_backtest_daily?backtest_id=eq.${backtestId}&user_id=eq.${uid}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw await restError(res, 'Could not clear backtest daily rows.');
}

function truncateHtml(sourceHtml) {
  const s = String(sourceHtml || '').trim();
  if (!s) return null;
  // Avoid blowing up row size; MT5 reports can be huge.
  return s.length > 50_000 ? `${s.slice(0, 50_000)}…` : s;
}

export async function saveBacktestUpload(backtestId, { currency, reportMeta, dailyRows, sourceHtml }) {
  const uid = getUserId();
  // Replace daily rows so the UI always matches the latest uploaded report.
  await deleteBacktestDaily(backtestId);

  const payload = {
    currency: currency === 'cent' ? 'cent' : 'usd',
    report_symbol: reportMeta?.symbol || null,
    range_from: reportMeta?.rangeFrom || null,
    range_to: reportMeta?.rangeTo || null,
    total_pnl: Number(reportMeta?.totalPnl) || 0,
    trade_count: Number(reportMeta?.tradeCount) || 0,
    wins: Number(reportMeta?.wins) || 0,
    losses: Number(reportMeta?.losses) || 0,
    be_count: Number(reportMeta?.beCount) || 0,
    profit_factor: reportMeta?.profitFactorInfinite ? null : (Number(reportMeta?.profitFactor) || null),
    source_html: JSON.stringify(reportMeta?.breakdown || { symbol: [], session: [] }),
    user_id: uid,
  };

  const updateRes = await authFetch(
    `${SUPABASE_URL}/rest/v1/strategy_backtests?id=eq.${backtestId}&user_id=eq.${uid}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    },
  );
  if (!updateRes.ok) throw await restError(updateRes, 'Could not update backtest.');

  const rows = (dailyRows || []).map((d) => ({
    user_id: uid,
    backtest_id: backtestId,
    date: d.date,
    pnl_usd: Math.round((Number(d.pnl_usd) || 0) * 100) / 100,
    trade_count: Number(d.trade_count) || 0,
    wins: Number(d.wins) || 0,
    losses: Number(d.losses) || 0,
    be_count: Number(d.be_count) || 0,
  }));

  for (let i = 0; i < rows.length; i += DAILY_CHUNK) {
    const chunk = rows.slice(i, i + DAILY_CHUNK);
    const res = await authFetch(
      `${SUPABASE_URL}/rest/v1/strategy_backtest_daily?on_conflict=backtest_id,date`,
      {
        method: 'POST',
        headers: { ...authHeaders(getToken()), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      },
    );
    if (!res.ok) throw await restError(res, 'Could not save backtest days.');
  }

  return true;
}

export async function deleteBacktest(id) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/strategy_backtests?id=eq.${id}&user_id=eq.${getUserId()}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw await restError(res, 'Could not delete backtest.');
}

export async function setBacktestPublic(backtestId, isPublic) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/set_backtest_public`, {
    method: 'POST',
    headers: authHeaders(getToken()),
    body: JSON.stringify({ p_backtest_id: backtestId, p_is_public: isPublic }),
  });
  if (!res.ok) throw await restError(res, 'Could not change public visibility.');
  return res.json();
}

export async function regenerateBacktestShareToken(backtestId) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/regenerate_backtest_share_token`, {
    method: 'POST',
    headers: authHeaders(getToken()),
    body: JSON.stringify({ p_backtest_id: backtestId }),
  });
  if (!res.ok) throw await restError(res, 'Could not regenerate share link.');
  return res.json();
}

export async function fetchSharedBacktest(token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: (await import('./auth')).SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) {
    let msg = 'Could not load shared strategy.';
    try {
      const body = await res.json();
      msg = body?.message || msg;
    } catch {
      // fallback
    }
    throw new Error(msg);
  }
  const data = await res.json();
  if (!data || !data.backtest) throw new Error('Strategy not found or no longer public.');
  return data;
}

export function getBacktestShareUrl(backtest) {
  if (!backtest || !backtest.is_public || !backtest.share_token) return null;
  return `${window.location.origin}/share/backtest/${backtest.share_token}`;
}
