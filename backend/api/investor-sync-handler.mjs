// backend/api/investor-sync-handler.mjs
import { verifySupabaseUser, readJsonBody } from './ai-checklist-handler.mjs';
import { supabaseHeaders } from './trade-sync-shared.mjs';

const BRIDGE_OFFLINE_MSG =
  'MetaTrader bridge is temporarily offline. Please try Sync again in a few minutes.';
const BRIDGE_AUTH_MSG =
  'Could not authorize the MetaTrader bridge. Please contact support if this keeps happening.';
const BRIDGE_BUSY_MSG =
  'MetaTrader bridge is busy right now. Please try Sync again shortly.';

function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function bridgeErrorMessage(status, detailText) {
  const detail = String(detailText || '');
  // Cloudflare origin failures often return HTML like "error code: 522".
  if (
    status === 521
    || status === 522
    || status === 523
    || status === 524
    || /\berror code:\s*52[1-4]\b/i.test(detail)
  ) {
    return BRIDGE_OFFLINE_MSG;
  }
  if (status === 401 || status === 403) return BRIDGE_AUTH_MSG;
  if (status === 429 || status === 503) return BRIDGE_BUSY_MSG;
  return BRIDGE_OFFLINE_MSG;
}

export async function handleTriggerInvestorSync(req, {
  supabaseUrl, anonKey, serviceKey, bridgeUrl, bridgeServiceToken,
}) {
  const auth = await verifySupabaseUser({ supabaseUrl, anonKey, accessToken: bearerToken(req) });
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  if (!bridgeUrl || !bridgeServiceToken) {
    return { status: 503, body: { error: BRIDGE_OFFLINE_MSG } };
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
    `${supabaseUrl}/rest/v1/investor_credentials?select=trading_account_id&trading_account_id=eq.${encodeURIComponent(tradingAccountId)}&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
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
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { status: 502, body: { error: BRIDGE_OFFLINE_MSG } };
  }

  if (!bridgeRes.ok) {
    const detail = await bridgeRes.text().catch(() => '');
    return {
      status: 502,
      body: {
        error: bridgeErrorMessage(bridgeRes.status, detail),
        bridge_status: bridgeRes.status,
        bridge_detail: String(detail || '').slice(0, 300) || null,
      },
    };
  }

  const bridgeBody = await bridgeRes.json().catch(() => ({}));
  return { status: 202, body: { queued: true, job_id: bridgeBody.job_id || null } };
}

export function getInvestorSyncDepsFromEnv(env = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bridgeUrl: (env.MT5_BRIDGE_URL || '').replace(/\/$/, ''),
    bridgeServiceToken: env.BRIDGE_SERVICE_TOKEN,
  };
}
