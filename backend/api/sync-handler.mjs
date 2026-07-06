import { createHash } from 'crypto';

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

function supabaseHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function resolvePnlUsd(trade, accountMeta, matchedAccount) {
  const raw = trade.pnl_raw != null ? Number(trade.pnl_raw) : null;
  const precomputed = Number(trade.pnl_usd) || 0;
  const denom = matchedAccount?.pnl_denomination || 'auto';

  if (denom === 'cent') {
    if (raw != null) return raw / 100;
    return precomputed;
  }
  if (denom === 'usd') {
    if (raw != null) return raw;
    return precomputed;
  }

  const divisor = Number(accountMeta?.pnl_divisor) || 1;
  if (raw != null && divisor > 1) return raw / divisor;
  return precomputed;
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

  const rows = trades.map((t) => {
    const pnl = resolvePnlUsd(t, accountMeta, matchedAccount);
    return {
      user_id: userId,
      source: 'api',
      ticket: t.ticket,
      symbol: t.symbol,
      direction: t.direction,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      lot_size: t.lot_size,
      pnl_usd: pnl,
      r_value: Number(t.r_value) || 0,
      result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
      open_time: t.open_time,
      close_time: t.close_time,
      date: (t.close_time || t.open_time || new Date().toISOString()).slice(0, 10),
      account: accountLabel,
      account_id: matchedAccount.id,
    };
  });

  const upsertRes = await fetch(
    `${supabaseUrl}/rest/v1/trades?on_conflict=user_id,ticket`,
    {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, {
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(rows),
    },
  );
  if (!upsertRes.ok) {
    const text = await upsertRes.text();
    return { status: 500, body: { error: text || 'Failed to save trades' } };
  }
  const saved = await upsertRes.json();

  return {
    status: 200,
    body: {
      received: trades.length,
      inserted: saved.length,
      updated: saved.length,
      account: accountLabel,
      account_meta: accountMeta
        ? {
            currency: accountMeta.currency || null,
            is_cent: Boolean(accountMeta.is_cent),
            pnl_divisor: Number(accountMeta.pnl_divisor) || 1,
          }
        : null,
    },
  };
}
