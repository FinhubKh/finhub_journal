// src/api/investorSync.js
import { authFetch, getToken, getUserId, SUPABASE_URL, authHeaders } from './auth';

function resolveApiBase() {
  if (import.meta.env.VITE_AI_API_URL) {
    return import.meta.env.VITE_AI_API_URL.replace(/\/$/, '');
  }
  // Same-origin in both Vite dev (plugin) and Vercel prod (rewrites).
  return '';
}

const API_BASE = resolveApiBase();

async function parseJson(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

export async function saveInvestorCredentials({ tradingAccountId, brokerServer, login, investorPassword }) {
  const res = await authFetch(`${API_BASE}/v1/investor-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      trading_account_id: tradingAccountId,
      broker_server: brokerServer,
      login,
      investor_password: investorPassword,
    }),
  });
  return parseJson(res);
}

export async function triggerInvestorSync(tradingAccountId) {
  const res = await authFetch(`${API_BASE}/v1/investor-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ trading_account_id: tradingAccountId }),
  });
  return parseJson(res);
}

export async function listInvestorCredentialsStatus() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/investor_credentials?select=trading_account_id,broker_server,login,last_synced_at,last_sync_error,updated_at&user_id=eq.${getUserId()}`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removeInvestorCredentials(tradingAccountId) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/investor_credentials?trading_account_id=eq.${tradingAccountId}&user_id=eq.${getUserId()}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
}
