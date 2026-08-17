/**
 * Bridge-facing endpoint: POST /v1/bridge/sync
 *
 * Called by the (trusted, self-operated) MT5 investor-password bridge after it
 * finishes reading trade history for an account. Authenticated by a shared
 * static service token (BRIDGE_SERVICE_TOKEN), not a per-account key, since
 * the caller is a service we operate rather than an untrusted third-party EA.
 *
 * Accepts two request shapes:
 *  - { trading_account_id, trades } on success
 *  - { trading_account_id, error }  when the bridge could not complete the
 *    job (bad investor credentials, broker server unreachable, etc.) so the
 *    failure is recorded instead of silently vanishing.
 */
import { readJsonBody } from './ai-checklist-handler.mjs';
import { supabaseHeaders, upsertSyncedTrades, upsertSyncedCashflows } from './trade-sync-shared.mjs';
import { timingSafeTokenEqual } from './crypto-helper.mjs';

export async function handleBridgeSync(req, { supabaseUrl, serviceKey, bridgeServiceToken }) {
  const token = req.headers['x-bridge-token'] || req.headers['X-Bridge-Token'] || '';
  // Explicit falsy checks (not just timingSafeTokenEqual) because an unset
  // BRIDGE_SERVICE_TOKEN + a request with no x-bridge-token header would
  // otherwise both coerce to zero-length buffers and compare equal.
  if (!bridgeServiceToken || !token || !timingSafeTokenEqual(token, bridgeServiceToken)) {
    return { status: 401, body: { error: 'Invalid bridge token' } };
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

  if (body?.error) {
    await fetch(
      `${supabaseUrl}/rest/v1/investor_credentials?trading_account_id=eq.${encodeURIComponent(tradingAccountId)}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(serviceKey),
        body: JSON.stringify({ last_sync_error: String(body.error).slice(0, 500) }),
      },
    );
    return { status: 200, body: { acknowledged: true, error_recorded: true } };
  }

  const trades = Array.isArray(body?.trades) ? body.trades : [];
  const cashflows = Array.isArray(body?.cashflows) ? body.cashflows : [];
  if (trades.length === 0 && cashflows.length === 0) {
    return { status: 400, body: { error: 'No trades or cashflows provided' } };
  }

  const accountRes = await fetch(
    `${supabaseUrl}/rest/v1/trading_accounts?select=id,user_id,name,pnl_denomination&id=eq.${encodeURIComponent(tradingAccountId)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!accountRes.ok) {
    return { status: 500, body: { error: 'Failed to load trading account' } };
  }
  const accountRows = await accountRes.json();
  const matchedAccount = accountRows[0];
  if (!matchedAccount) {
    return { status: 404, body: { error: 'Trading account not found' } };
  }

  let saved = [];
  let savedCash = [];
  try {
    if (trades.length > 0) {
      saved = await upsertSyncedTrades({
        trades,
        userId: matchedAccount.user_id,
        matchedAccount,
        source: 'investor_bridge',
        supabaseUrl,
        serviceKey,
      });
    }
    if (cashflows.length > 0) {
      savedCash = await upsertSyncedCashflows({
        cashflows,
        userId: matchedAccount.user_id,
        matchedAccount,
        source: 'investor_bridge',
        supabaseUrl,
        serviceKey,
      });
    }
  } catch (err) {
    return { status: 500, body: { error: err.message || 'Failed to save trades' } };
  }

  const syncedAt = new Date().toISOString();
  await fetch(
    `${supabaseUrl}/rest/v1/investor_credentials?trading_account_id=eq.${encodeURIComponent(tradingAccountId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({ last_synced_at: syncedAt, last_sync_error: null }),
    },
  );

  return {
    status: 200,
    body: {
      received: trades.length,
      inserted: saved.length,
      cashflows: savedCash.length,
      account: matchedAccount.name,
      last_synced_at: syncedAt,
    },
  };
}

export function getBridgeSyncDepsFromEnv(env = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bridgeServiceToken: env.BRIDGE_SERVICE_TOKEN,
  };
}
