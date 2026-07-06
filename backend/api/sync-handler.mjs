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

function resolveAccountId(label, tradingAccounts) {
  if (!label?.trim()) return null;
  const trimmed = label.trim();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const bySlug = tradingAccounts.find((a) => a.slug === slug);
  if (bySlug) return bySlug.id;
  const byName = tradingAccounts.find((a) => a.name.trim().toLowerCase() === trimmed.toLowerCase());
  return byName?.id || null;
}

export async function handleEaSync({ syncKey, trades, supabaseUrl, serviceKey }) {
  if (!syncKey?.trim()) {
    return { status: 401, body: { error: 'Missing x-sync-key header' } };
  }
  if (!Array.isArray(trades) || trades.length === 0) {
    return { status: 400, body: { error: 'No trades provided' } };
  }

  const keyHash = sha256Hex(syncKey.trim());
  const keyRes = await fetch(
    `${supabaseUrl}/rest/v1/sync_keys?select=user_id&key_hash=eq.${encodeURIComponent(keyHash)}&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!keyRes.ok) {
    const text = await keyRes.text();
    return { status: 500, body: { error: text || 'Failed to verify sync key' } };
  }
  const keyRows = await keyRes.json();
  const userId = keyRows[0]?.user_id;
  if (!userId) {
    return { status: 401, body: { error: 'Invalid sync key' } };
  }

  const accountsRes = await fetch(
    `${supabaseUrl}/rest/v1/trading_accounts?select=id,name,slug&user_id=eq.${encodeURIComponent(userId)}`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!accountsRes.ok) {
    const text = await accountsRes.text();
    return { status: 500, body: { error: text || 'Failed to load trading accounts' } };
  }
  const tradingAccounts = await accountsRes.json();

  const rows = trades.map((t) => {
    const pnl = Number(t.pnl_usd) || 0;
    const accountLabel = t.account?.trim() || null;
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
      account_id: resolveAccountId(accountLabel, tradingAccounts),
    };
  });

  const upsertRes = await fetch(
    `${supabaseUrl}/rest/v1/trades?on_conflict=user_id,ticket`,
    {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, {
        Prefer: 'resolution=ignore-duplicates,return=representation',
      }),
      body: JSON.stringify(rows),
    },
  );
  if (!upsertRes.ok) {
    const text = await upsertRes.text();
    return { status: 500, body: { error: text || 'Failed to save trades' } };
  }
  const inserted = await upsertRes.json();

  return {
    status: 200,
    body: {
      received: trades.length,
      inserted: inserted.length,
      skipped: trades.length - inserted.length,
    },
  };
}
