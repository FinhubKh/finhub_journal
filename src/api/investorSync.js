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

const VERIFY_POLL_MS = 2000;
const VERIFY_POLL_ATTEMPTS = 30;

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

/** Save credentials and enqueue an MT5 login-only verify job. */
export async function connectInvestorCredentials({ tradingAccountId, brokerServer, login, investorPassword }) {
  const res = await authFetch(`${API_BASE}/v1/investor-connect`, {
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

export async function getInvestorVerifyStatus({ jobId, tradingAccountId }) {
  const qs = new URLSearchParams({
    job_id: jobId,
    trading_account_id: tradingAccountId,
  });
  const res = await authFetch(`${API_BASE}/v1/investor-verify?${qs.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  return parseJson(res);
}

/**
 * Connect investor credentials and wait until MT5 login verify finishes.
 * Throws with a user-facing message on failure / timeout.
 */
export async function connectAndVerifyInvestorCredentials(params) {
  const started = await connectInvestorCredentials(params);
  const jobId = started.job_id;
  const tradingAccountId = params.tradingAccountId;

  async function cleanupUnverified() {
    try {
      await removeInvestorCredentials(tradingAccountId);
    } catch {
      // best-effort — backend also deletes on failed status polls
    }
  }

  for (let i = 0; i < VERIFY_POLL_ATTEMPTS; i += 1) {
    await sleep(VERIFY_POLL_MS);
    let status;
    try {
      status = await getInvestorVerifyStatus({ jobId, tradingAccountId });
    } catch (err) {
      await cleanupUnverified();
      throw err;
    }
    if (status.status === 'pending') continue;
    if (status.status === 'ok') return { ok: true, ...started };
    throw new Error(
      status.error || 'Login failed — check broker server, MT5 login, and investor password',
    );
  }

  const last = await getInvestorVerifyStatus({ jobId, tradingAccountId }).catch(() => null);
  if (last?.status === 'ok') return { ok: true, ...started };
  if (last?.status === 'failed') {
    throw new Error(
      last.error || 'Login failed — check broker server, MT5 login, and investor password',
    );
  }
  await cleanupUnverified();
  throw new Error('Could not verify right now — bridge busy or unreachable. Try again.');
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
