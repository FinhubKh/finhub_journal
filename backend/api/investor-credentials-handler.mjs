/**
 * User-facing endpoint: POST /v1/investor-credentials
 *
 * Called by an authenticated app user to save (or update) the MT5 investor
 * (read-only) password for one of their trading accounts. The plaintext
 * password is encrypted with AES-256-GCM (crypto-helper.mjs) before it is
 * ever written to the database, and the ciphertext is never echoed back in
 * a response. This is the write-path counterpart to the bridge's read-only
 * sync path (bridge-sync-handler.mjs) — it's how a user's investor password
 * gets into the investor_credentials table in the first place.
 */
import { verifySupabaseUser, readJsonBody } from './ai-checklist-handler.mjs';
import { encryptSecret } from './crypto-helper.mjs';
import { supabaseHeaders } from './trade-sync-shared.mjs';

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function handleSaveInvestorCredentials(req, { supabaseUrl, anonKey, serviceKey, encryptionKey }) {
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

  // Ownership check: the trading account must belong to the authenticated
  // user before we write any credentials against it. Queried with the
  // service key (RLS is bypassed for this handler) but scoped explicitly
  // by both id and user_id so a stranger's account id can't be targeted.
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
        updated_at: new Date().toISOString(),
      }]),
    },
  );
  if (!upsertRes.ok) {
    // Deliberately not including the upstream response text here: it could
    // theoretically echo back request payload fields. Keep this generic.
    return { status: 500, body: { error: 'Failed to save investor credentials' } };
  }

  return { status: 200, body: { ok: true, broker_server: brokerServer, login } };
}

export function getInvestorCredentialsDepsFromEnv(env = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    encryptionKey: env.INVESTOR_CRED_ENCRYPTION_KEY,
  };
}
