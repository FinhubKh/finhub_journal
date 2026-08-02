import { createHash } from 'crypto';
import { supabaseHeaders, accountDenomination, upsertSyncedTrades } from './trade-sync-shared.mjs';

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

export async function handleEaSync({ syncKey, trades, accountMeta, supabaseUrl, serviceKey }) {
  if (!syncKey?.trim()) {
    return { status: 401, body: { error: 'Missing x-sync-key header' } };
  }
  if (!Array.isArray(trades) || trades.length === 0) {
    return { status: 400, body: { error: 'No trades provided' } };
  }

  const keyHash = sha256Hex(syncKey.trim());
  const keyRes = await fetch(
    `${supabaseUrl}/rest/v1/sync_keys?select=user_id,trading_account_id&key_hash=eq.${encodeURIComponent(keyHash)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!keyRes.ok) {
    const text = await keyRes.text();
    return { status: 500, body: { error: text || 'Failed to verify sync key' } };
  }
  const keyRows = await keyRes.json();
  const keyRow = keyRows[0];
  const userId = keyRow?.user_id;
  const tradingAccountId = keyRow?.trading_account_id;
  if (!userId || !tradingAccountId) {
    return { status: 401, body: { error: 'Invalid sync key' } };
  }

  const accountRes = await fetch(
    `${supabaseUrl}/rest/v1/trading_accounts?select=id,name,pnl_denomination&id=eq.${encodeURIComponent(tradingAccountId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!accountRes.ok) {
    const text = await accountRes.text();
    return { status: 500, body: { error: text || 'Failed to load trading account' } };
  }
  const accountRows = await accountRes.json();
  const matchedAccount = accountRows[0];
  if (!matchedAccount) {
    return { status: 401, body: { error: 'Sync key is not linked to a trading account' } };
  }

  const accountLabel = matchedAccount.name;

  let saved;
  try {
    saved = await upsertSyncedTrades({
      trades,
      userId,
      matchedAccount,
      source: 'api',
      supabaseUrl,
      serviceKey,
    });
  } catch (err) {
    return { status: 500, body: { error: err.message || 'Failed to save trades' } };
  }

  const syncedAt = new Date().toISOString();
  await fetch(
    `${supabaseUrl}/rest/v1/sync_keys?trading_account_id=eq.${encodeURIComponent(tradingAccountId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({ last_synced_at: syncedAt }),
    },
  );

  return {
    status: 200,
    body: {
      received: trades.length,
      inserted: saved.length,
      updated: saved.length,
      account: accountLabel,
      pnl_denomination: accountDenomination(matchedAccount),
      last_synced_at: syncedAt,
    },
  };
}
