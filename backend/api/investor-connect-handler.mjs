/**
 * Connect + verify investor credentials against the MT5 bridge before
 * treating the account as Connected.
 *
 * POST /v1/investor-connect  — save encrypted creds, enqueue verify job
 * GET  /v1/investor-verify   — poll job result; delete creds only on a
 *                              confirmed bad login, not on bridge hiccups
 */
import { verifySupabaseUser, readJsonBody } from './ai-checklist-handler.mjs';
import { encryptSecret } from './crypto-helper.mjs';
import { supabaseHeaders } from './trade-sync-shared.mjs';

const LOGIN_FAILED_MSG = 'Login failed — check broker server, MT5 login, and investor password';
const VERIFY_UNAVAILABLE_MSG = 'Could not verify right now — bridge busy or unreachable. Your login is saved; try Sync now shortly.';

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function queryValue(req, key) {
  if (req.query && req.query[key] != null) return String(req.query[key]).trim();
  try {
    const url = new URL(req.url || '', 'http://localhost');
    return (url.searchParams.get(key) || '').trim();
  } catch {
    return '';
  }
}

async function deleteInvestorCredentials({ supabaseUrl, serviceKey, tradingAccountId, userId }) {
  await fetch(
    `${supabaseUrl}/rest/v1/investor_credentials?trading_account_id=eq.${encodeURIComponent(tradingAccountId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: supabaseHeaders(serviceKey) },
  );
}

export async function handleConnectInvestorCredentials(req, {
  supabaseUrl, anonKey, serviceKey, encryptionKey, bridgeUrl, bridgeServiceToken,
}) {
  const auth = await verifySupabaseUser({ supabaseUrl, anonKey, accessToken: bearerToken(req) });
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  let body;
  try {
    body = req.body && typeof req.body === 'object' ? req.body : await readJsonBody(req);
  } catch {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }

  const tradingAccountId = body?.trading_account_id;
  const brokerServer = String(body?.broker_server || '').trim();
  const login = String(body?.login || '').trim();
  const investorPassword = String(body?.investor_password || '');

  if (!tradingAccountId || !brokerServer || !login || !investorPassword) {
    return {
      status: 400,
      body: { error: 'trading_account_id, broker_server, login, and investor_password are required' },
    };
  }

  const accountRes = await fetch(
    `${supabaseUrl}/rest/v1/trading_accounts?select=id&id=eq.${encodeURIComponent(tradingAccountId)}&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!accountRes.ok) {
    return { status: 500, body: { error: 'Failed to verify trading account' } };
  }
  const accountRows = await accountRes.json();
  if (!accountRows[0]) {
    return { status: 404, body: { error: 'Trading account not found' } };
  }

  const encryptedPassword = encryptSecret(investorPassword, encryptionKey);
  const upsertRes = await fetch(
    `${supabaseUrl}/rest/v1/investor_credentials?on_conflict=trading_account_id`,
    {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, {
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify([{
        user_id: auth.user.id,
        trading_account_id: tradingAccountId,
        broker_server: brokerServer,
        login,
        encrypted_password: encryptedPassword,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      }]),
    },
  );
  if (!upsertRes.ok) {
    return { status: 500, body: { error: 'Failed to save investor credentials' } };
  }

  // From here on, credentials are already saved. A bridge hiccup below is
  // transient infra trouble, not proof the login is wrong — keep the row so
  // the user isn't forced to retype their password; only a confirmed bad
  // login (see handleInvestorVerifyStatus) should delete it.
  let bridgeRes;
  try {
    bridgeRes = await fetch(`${bridgeUrl}/jobs/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': bridgeServiceToken,
      },
      body: JSON.stringify({
        trading_account_id: tradingAccountId,
        login,
        password: investorPassword,
        server: brokerServer,
      }),
    });
  } catch {
    return { status: 502, body: { error: VERIFY_UNAVAILABLE_MSG } };
  }

  if (!bridgeRes.ok) {
    await bridgeRes.text().catch(() => '');
    return { status: 502, body: { error: VERIFY_UNAVAILABLE_MSG } };
  }

  const bridgeBody = await bridgeRes.json().catch(() => ({}));
  const jobId = bridgeBody.job_id || null;
  if (!jobId) {
    return { status: 502, body: { error: VERIFY_UNAVAILABLE_MSG } };
  }

  return {
    status: 202,
    body: {
      verifying: true,
      job_id: jobId,
      trading_account_id: tradingAccountId,
      broker_server: brokerServer,
      login,
    },
  };
}

export async function handleInvestorVerifyStatus(req, {
  supabaseUrl, anonKey, serviceKey, encryptionKey, bridgeUrl, bridgeServiceToken,
}) {
  const auth = await verifySupabaseUser({ supabaseUrl, anonKey, accessToken: bearerToken(req) });
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const jobId = queryValue(req, 'job_id');
  const tradingAccountId = queryValue(req, 'trading_account_id');
  if (!jobId || !tradingAccountId) {
    return { status: 400, body: { error: 'job_id and trading_account_id are required' } };
  }

  const credRes = await fetch(
    `${supabaseUrl}/rest/v1/investor_credentials?select=trading_account_id&trading_account_id=eq.${encodeURIComponent(tradingAccountId)}&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!credRes.ok) {
    return { status: 500, body: { error: 'Failed to load investor credentials' } };
  }
  const credRows = await credRes.json();
  if (!credRows[0]) {
    return {
      status: 200,
      body: { status: 'failed', error: LOGIN_FAILED_MSG },
    };
  }

  // A bridge hiccup here is transient infra trouble, not a confirmed bad
  // login — keep the credentials so the user isn't forced to reconnect.
  // Only delete below once the bridge actually answers with a bad login.
  let bridgeRes;
  try {
    bridgeRes = await fetch(`${bridgeUrl}/jobs/${encodeURIComponent(jobId)}/result`, {
      headers: { 'x-bridge-token': bridgeServiceToken },
    });
  } catch {
    return { status: 200, body: { status: 'failed', error: VERIFY_UNAVAILABLE_MSG } };
  }

  if (bridgeRes.status === 404) {
    return { status: 200, body: { status: 'pending' } };
  }
  if (!bridgeRes.ok) {
    await bridgeRes.text().catch(() => '');
    return { status: 200, body: { status: 'failed', error: VERIFY_UNAVAILABLE_MSG } };
  }

  const result = await bridgeRes.json().catch(() => ({}));
  if (result?.trading_account_id && result.trading_account_id !== tradingAccountId) {
    return { status: 403, body: { error: 'Job does not match trading account' } };
  }
  if (!result || result.status === 'pending') {
    return { status: 200, body: { status: 'pending' } };
  }

  if (result.ok === true) {
    return { status: 200, body: { status: 'ok' } };
  }

  // The bridge gave us a definitive answer and it's a bad login — the saved
  // credentials are actually wrong, so there's no reason to keep them.
  await deleteInvestorCredentials({
    supabaseUrl,
    serviceKey,
    tradingAccountId,
    userId: auth.user.id,
  });
  return {
    status: 200,
    body: {
      status: 'failed',
      error: typeof result.error === 'string' && result.error
        ? result.error
        : LOGIN_FAILED_MSG,
    },
  };
}

export function getInvestorConnectDepsFromEnv(env = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    encryptionKey: env.INVESTOR_CRED_ENCRYPTION_KEY,
    bridgeUrl: (env.MT5_BRIDGE_URL || '').replace(/\/$/, ''),
    bridgeServiceToken: env.BRIDGE_SERVICE_TOKEN,
  };
}
