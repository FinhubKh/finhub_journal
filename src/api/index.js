/**
 * nXuu — API layer
 * Supabase REST data calls (trades, checklist, models, sync keys).
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, authHeaders, getToken, getUserId, authFetch } from './auth';
import { deleteAllTradeImages } from './tradeImages';

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
  // Always scope to the signed-in user. Public RLS also allows SELECT on
  // published accounts, which would otherwise flood Settings with everyone else's.
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trading_accounts?select=*&user_id=eq.${uid}&order=is_default.desc,created_at.asc`,
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

function pnlResult(pnl) {
  if (pnl > 0) return 'win';
  if (pnl < 0) return 'loss';
  return 'be';
}

async function fetchTradesForAccount(account) {
  const uid = getUserId();
  const byIdRes = await authFetch(
    `${SUPABASE_URL}/rest/v1/trades?select=id,pnl_usd&account_id=eq.${account.id}&user_id=eq.${uid}`,
    { headers: authHeaders(getToken()) },
  );
  if (!byIdRes.ok) throw new Error(await byIdRes.text());

  const trades = new Map((await byIdRes.json()).map((t) => [t.id, t]));

  if (account.name?.trim()) {
    const byNameRes = await authFetch(
      `${SUPABASE_URL}/rest/v1/trades?select=id,pnl_usd&account=eq.${encodeURIComponent(account.name.trim())}&user_id=eq.${uid}`,
      { headers: authHeaders(getToken()) },
    );
    if (!byNameRes.ok) throw new Error(await byNameRes.text());
    (await byNameRes.json()).forEach((t) => trades.set(t.id, t));
  }

  return [...trades.values()];
}

async function patchTradePnl(trades, factor) {
  await Promise.all(trades.map(async (t) => {
    const pnl = Math.round((Number(t.pnl_usd) || 0) * factor * 100) / 100;
    const patchRes = await authFetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${t.id}`, {
      method: 'PATCH',
      headers: authHeaders(getToken()),
      body: JSON.stringify({ pnl_usd: pnl, result: pnlResult(pnl) }),
    });
    if (!patchRes.ok) throw new Error(await patchRes.text());
  }));
}

/** Adjust stored PnL when switching account between cent and USD. */
export async function recalculateTradesForDenomination(account, oldDenom, newDenom) {
  const oldNorm = oldDenom === 'cent' ? 'cent' : 'usd';
  const newNorm = newDenom === 'cent' ? 'cent' : 'usd';
  if (!account?.id || oldNorm === newNorm) return 0;

  let factor = null;
  if (newNorm === 'cent' && oldNorm !== 'cent') factor = 0.01;
  else if (newNorm === 'usd' && oldNorm === 'cent') factor = 100;
  if (factor == null) return 0;

  const trades = await fetchTradesForAccount(account);
  if (trades.length === 0) return 0;

  await patchTradePnl(trades, factor);
  return trades.length;
}

/** One-time repair: divide all account trades by 100 (cent account with inflated PnL). */
export async function repairCentAccountPnl(account) {
  if (!account?.id) return 0;
  const trades = await fetchTradesForAccount(account);
  if (trades.length === 0) return 0;
  await patchTradePnl(trades, 0.01);
  return trades.length;
}

export async function fetchAllTrades() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&user_id=eq.${getUserId()}&order=date.desc,created_at.desc`,
    {
      headers: authHeaders(getToken()),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTradesByMonth(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&user_id=eq.${getUserId()}&date=gte.${from}&date=lte.${to}&order=date.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── DAILY PNL ──
export async function fetchDailyPnlByYear(year) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/daily_pnl?select=*&user_id=eq.${getUserId()}&date=gte.${from}&date=lte.${to}&order=date.asc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(await res.text());
  }
  return res.json();
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
  const allowed = { r_value: fields.r_value, model: fields.model, session: fields.session, notes: fields.notes };
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
    body: JSON.stringify({ user_id: getUserId(), section, title, position }),
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

// ── ENTRY MODELS ──
export async function fetchModels() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/entry_models?select=*&order=created_at.asc`, {
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function insertModel(name) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/entry_models`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: getUserId(), name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteModel(id) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/entry_models?id=eq.${id}`, {
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
    `${SUPABASE_URL}/rest/v1/sync_keys?select=trading_account_id,id&user_id=eq.${getUserId()}`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAccountSyncKey(accountId) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?select=raw_key&trading_account_id=eq.${accountId}&user_id=eq.${getUserId()}&limit=1`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.raw_key || null;
}

export async function generateAccountSyncKey(accountId) {
  const rawKey = await generateRandomKey();
  const keyHash = await sha256Hex(rawKey);
  await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?trading_account_id=eq.${accountId}&user_id=eq.${getUserId()}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: getUserId(),
      trading_account_id: accountId,
      key_hash: keyHash,
      raw_key: rawKey,
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
