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

const VERIFY_POLL_MS = 400;
const VERIFY_POLL_ATTEMPTS = 75; // ~30s after the first immediate check

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

  // The backend only deletes credentials once it gets a confirmed bad login
  // from the bridge — a network hiccup here is transient, so we just
  // surface the error and leave the saved credentials alone.
  for (let i = 0; i < VERIFY_POLL_ATTEMPTS; i += 1) {
    // Check immediately on the first loop — don't burn time before looking.
    if (i > 0) await sleep(VERIFY_POLL_MS);
    const status = await getInvestorVerifyStatus({ jobId, tradingAccountId });
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
  throw new Error('Could not verify right now — bridge busy or unreachable. Your login is saved; try Sync now shortly.');
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

const SYNC_POLL_MS = 500;
const SYNC_POLL_ATTEMPTS = 240; // ~2 minutes after the first immediate check

/**
 * Queue investor sync and keep polling until trades land or the worker records an error.
 */
export async function runInvestorSyncAndWait(tradingAccountId, { onStatus } = {}) {
  const rowsBefore = await listInvestorCredentialsStatus();
  const baseline = rowsBefore.find((r) => r.trading_account_id === tradingAccountId) || null;
  if (!baseline) {
    throw new Error('No investor credentials configured for this account');
  }

  const baselineSynced = baseline.last_synced_at || null;
  const baselineUpdated = baseline.updated_at || null;
  const baselineError = baseline.last_sync_error || null;

  await triggerInvestorSync(tradingAccountId);

  for (let i = 0; i < SYNC_POLL_ATTEMPTS; i += 1) {
    if (i > 0) await sleep(SYNC_POLL_MS);

    let rows;
    try {
      rows = await listInvestorCredentialsStatus();
    } catch {
      continue;
    }
    const row = rows.find((r) => r.trading_account_id === tradingAccountId) || null;
    if (!row) continue;
    if (typeof onStatus === 'function') onStatus(row);

    if (row.last_synced_at && row.last_synced_at !== baselineSynced) {
      return { ok: true, row };
    }

    const updatedChanged = Boolean(row.updated_at && row.updated_at !== baselineUpdated);
    const errorChanged = (row.last_sync_error || null) !== baselineError;
    if (row.last_sync_error && (updatedChanged || errorChanged)) {
      return { ok: false, row, error: row.last_sync_error };
    }
  }

  const rowsAfter = await listInvestorCredentialsStatus().catch(() => []);
  const latest = rowsAfter.find((r) => r.trading_account_id === tradingAccountId) || null;
  if (latest?.last_synced_at && latest.last_synced_at !== baselineSynced) {
    return { ok: true, row: latest };
  }
  if (latest?.last_sync_error && latest.last_sync_error !== baselineError) {
    return { ok: false, row: latest, error: latest.last_sync_error };
  }
  throw new Error('Sync timed out — the bridge may be busy. Try again.');
}

export async function listInvestorCredentialsStatus() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/investor_credentials?select=trading_account_id,broker_server,login,last_synced_at,last_sync_error,sync_stage,updated_at&user_id=eq.${getUserId()}`,
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
