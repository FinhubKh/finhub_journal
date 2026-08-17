import { SUPABASE_URL, SUPABASE_ANON_KEY, authHeaders, getToken, getUserId, authFetch } from './auth';
import { deleteAllTradeImages } from './tradeImages';

/** Columns used across journal UI — avoid select=*. */
export const TRADE_SELECT = [
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

export const TRADING_ACCOUNT_SELECT = [
  'id',
  'user_id',
  'name',
  'slug',
  'account_type',
  'broker',
  'starting_balance',
  'color',
  'is_default',
  'connection_status',
  'pnl_denomination',
  'is_public',
  'share_token',
  'published_at',
  'created_at',
].join(',');

const TRADE_PAGE_SIZE = 1000;

export async function insertTrade(trade) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ ...trade, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── TRADING ACCOUNTS ──
export async function fetchTradingAccounts() {
  const uid = getUserId();
  // Scope to the signed-in user (owners use their own RLS policy).
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trading_accounts?select=${TRADING_ACCOUNT_SELECT}&user_id=eq.${uid}&order=is_default.desc,created_at.asc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(await res.text());
  }
  return res.json();
}

export async function insertTradingAccount(account) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trading_accounts`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ ...account, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateTradingAccount(id, fields) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trading_accounts?id=eq.${id}&user_id=eq.${getUserId()}`,
    {
      method: 'PATCH',
      headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
      body: JSON.stringify(fields),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTradingAccount(accountOrId) {
  const id = typeof accountOrId === 'object' ? accountOrId.id : accountOrId;
  const name = typeof accountOrId === 'object' ? accountOrId.name?.trim() : null;
  const uid = getUserId();

  const delById = await authFetch(
    `${SUPABASE_URL}/rest/v1/trades?account_id=eq.${id}&user_id=eq.${uid}`,
    {
      method: 'DELETE',
      headers: authHeaders(getToken()),
    },
  );
  if (!delById.ok) throw new Error(await delById.text());

  if (name) {
    const delByName = await authFetch(
      `${SUPABASE_URL}/rest/v1/trades?account=eq.${encodeURIComponent(name)}&user_id=eq.${uid}`,
      { method: 'DELETE', headers: authHeaders(getToken()) },
    );
    if (!delByName.ok) throw new Error(await delByName.text());
  }

  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trading_accounts?id=eq.${id}&user_id=eq.${uid}`,
    {
      method: 'DELETE',
      headers: authHeaders(getToken()),
    },
  );
  if (!res.ok) throw new Error(await res.text());
}

async function fetchPaginated(urlStr, pageSize = TRADE_PAGE_SIZE) {
  const out = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const res = await authFetch(urlStr, {
      headers: {
        ...authHeaders(getToken()),
        Range: `${from}-${to}`,
      },
    });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(await res.text());
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/**
 * When switching Cent ↔ USD, rescale stored trade PnL so amounts keep matching
 * what MT5 shows (cent units ↔ dollar units = ×100 / ÷100).
 * One SQL statement so daily-stats refresh cannot race itself.
 */
export async function recalculateTradesForDenomination(account, oldDenom, newDenom) {
  const from = oldDenom === 'cent' ? 'cent' : 'usd';
  const to = newDenom === 'cent' ? 'cent' : 'usd';
  if (from === to) return 0;
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/rescale_account_pnl`, {
    method: 'POST',
    headers: authHeaders(getToken()),
    body: JSON.stringify({
      p_account_id: account.id,
      p_from: from,
      p_to: to,
    }),
  });
  if (!res.ok) {
    let msg = res.statusText || 'Could not rescale trades.';
    try {
      const body = await res.json();
      msg = body?.message || body?.hint || JSON.stringify(body);
    } catch {
      /* keep status text */
    }
    throw new Error(msg);
  }
  const count = await res.json();
  return Number(count) || 0;
}

export async function fetchAllTrades() {
  const uid = getUserId();
  return fetchPaginated(
    `${SUPABASE_URL}/rest/v1/trades?select=${TRADE_SELECT}&user_id=eq.${uid}&order=date.desc,created_at.desc`,
  );
}

export async function fetchTradesByMonth(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return fetchPaginated(
    `${SUPABASE_URL}/rest/v1/trades?select=${TRADE_SELECT}&user_id=eq.${getUserId()}&date=gte.${from}&date=lte.${to}&order=date.asc`,
  );
}

// ── DAILY PNL ──
export async function fetchDailyPnlByYear(year) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  return fetchPaginated(
    `${SUPABASE_URL}/rest/v1/daily_pnl?select=*&user_id=eq.${getUserId()}&date=gte.${from}&date=lte.${to}&order=date.asc`,
  );
}

export async function upsertDailyPnl({ date, pnl_usd, trade_count, notes }) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/daily_pnl?on_conflict=user_id,date`,
    {
      method: 'POST',
      headers: { ...authHeaders(getToken()), Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: getUserId(),
        date,
        pnl_usd,
        trade_count: trade_count != null ? Number(trade_count) : null,
        notes: notes?.trim() || null,
      }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteDailyPnl(date) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/daily_pnl?date=eq.${date}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteTrade(id) {
  try {
    await deleteAllTradeImages(id);
  } catch {
    // ignore if images table/storage not set up yet
  }
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateTradeAnnotation(id, fields) {
  const allowed = { r_value: fields.r_value, session: fields.session, notes: fields.notes };
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(allowed),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── CHECKLIST STEPS ──
export async function fetchSteps() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/checklist_steps?select=*&order=position.asc`, {
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function insertStep(section, title, position) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/checklist_steps`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: getUserId(),
      section,
      title,
      position,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateStep(id, fields) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/checklist_steps?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteStep(id) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/checklist_steps?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── MT4/5 SYNC KEY (per trading account) ──
async function generateRandomKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listAccountSyncKeys() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?select=trading_account_id,id,last_synced_at&user_id=eq.${getUserId()}`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Returns whether a sync key exists for the account (never returns the raw key). */
export async function hasAccountSyncKey(accountId) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?select=id&trading_account_id=eq.${accountId}&user_id=eq.${getUserId()}&limit=1`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Boolean(rows[0]?.id);
}

/** Creates a new sync key. Raw key is returned once and is not stored in the database. */
export async function generateAccountSyncKey(accountId) {
  const rawKey = await generateRandomKey();
  const keyHash = await sha256Hex(rawKey);
  await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?trading_account_id=eq.${accountId}&user_id=eq.${getUserId()}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: getUserId(),
      trading_account_id: accountId,
      key_hash: keyHash,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return rawKey;
}

export async function revokeAccountSyncKey(accountId) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?trading_account_id=eq.${accountId}&user_id=eq.${getUserId()}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
}

export * from './compounding';
export * from './share';
export * from './investorSync';
export * from './journal';
