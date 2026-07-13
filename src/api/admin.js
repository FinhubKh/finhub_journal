import { SUPABASE_URL, authFetch, authHeaders, getToken } from './auth';

async function rpc(name, body = {}) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function adminPlatformStats() {
  return rpc('admin_platform_stats');
}

export async function adminListUsers() {
  return rpc('admin_list_users');
}

export async function adminSetUserRole(userId, role) {
  return rpc('admin_set_user_role', { target_user_id: userId, new_role: role });
}

export async function adminDeleteUser(userId) {
  return rpc('admin_delete_user', { target_user_id: userId });
}

export async function adminFetchTradingAccounts() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trading_accounts?select=id,user_id,name,account_type,broker,pnl_denomination,is_default,created_at&order=created_at.desc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminDeleteTradingAccount(id) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/trading_accounts?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function adminFetchSyncKeys() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?select=id,user_id,trading_account_id,created_at&order=created_at.desc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminRevokeSyncKey(id) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/sync_keys?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}
