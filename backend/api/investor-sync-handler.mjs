// backend/api/investor-sync-handler.mjs
import { verifySupabaseUser, readJsonBody } from './ai-checklist-handler.mjs';
import { decryptSecret } from './crypto-helper.mjs';
import { supabaseHeaders } from './trade-sync-shared.mjs';

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function handleTriggerInvestorSync(req, {
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
  if (!tradingAccountId) {
    return { status: 400, body: { error: 'trading_account_id is required' } };
  }

  const credRes = await fetch(
    `${supabaseUrl}/rest/v1/investor_credentials?select=broker_server,login,encrypted_password&trading_account_id=eq.${encodeURIComponent(tradingAccountId)}&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!credRes.ok) {
    return { status: 500, body: { error: 'Failed to load investor credentials' } };
  }
  const credRows = await credRes.json();
  const cred = credRows[0];
  if (!cred) {
    return { status: 404, body: { error: 'No investor credentials configured for this account' } };
  }

  let password;
  try {
    password = decryptSecret(cred.encrypted_password, encryptionKey);
  } catch {
    return { status: 500, body: { error: 'Could not decrypt stored credentials' } };
  }

  let bridgeRes;
  try {
    bridgeRes = await fetch(`${bridgeUrl}/jobs/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-token': bridgeServiceToken,
      },
      body: JSON.stringify({
        trading_account_id: tradingAccountId,
        login: cred.login,
        password,
        server: cred.broker_server,
      }),
    });
  } catch {
    return { status: 502, body: { error: 'Bridge service is unreachable' } };
  }

  if (!bridgeRes.ok) {
    await bridgeRes.text().catch(() => '');
    return { status: 502, body: { error: 'Bridge service rejected the sync job' } };
  }

  const bridgeBody = await bridgeRes.json().catch(() => ({}));
  return { status: 202, body: { queued: true, job_id: bridgeBody.job_id || null } };
}

export function getInvestorSyncDepsFromEnv(env = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    encryptionKey: env.INVESTOR_CRED_ENCRYPTION_KEY,
    bridgeUrl: (env.MT5_BRIDGE_URL || '').replace(/\/$/, ''),
    bridgeServiceToken: env.BRIDGE_SERVICE_TOKEN,
  };
}
