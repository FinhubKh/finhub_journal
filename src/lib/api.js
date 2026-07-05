/**
 * nXuu — api.js
 * All Supabase REST data calls (trades, checklist steps, entry models,
 * MT4/5 sync keys, leaderboard). Mirrors the original js/supabase.js.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, authHeaders, getToken, getUserId, authFetch } from './auth';

export async function insertTrade(trade) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ ...trade, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAllTrades() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trades?select=*&order=date.desc,created_at.desc`, {
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTradesByMonth(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&date=gte.${from}&date=lte.${to}&order=date.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteTrade(id) {
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

// ── MT4/5 SYNC KEY ──
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

export async function generateSyncKey() {
  const rawKey = await generateRandomKey();
  const keyHash = await sha256Hex(rawKey);
  await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys?user_id=eq.${getUserId()}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: getUserId(), key_hash: keyHash, raw_key: rawKey }),
  });
  if (!res.ok) throw new Error(await res.text());
  return rawKey;
}

export async function getSyncKey() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys?select=raw_key&user_id=eq.${getUserId()}`, {
    headers: authHeaders(getToken()),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.raw_key || null;
}

export async function hasSyncKey() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys?select=id&user_id=eq.${getUserId()}`, {
    headers: authHeaders(getToken()),
  });
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

export async function revokeSyncKey() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys?user_id=eq.${getUserId()}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── LEADERBOARD ──
export async function fetchLeaderboard() {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({}),
  });
  if (!res.ok) return [];
  return res.json();
}