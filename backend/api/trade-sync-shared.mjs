export function supabaseHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function accountDenomination(matchedAccount) {
  return matchedAccount?.pnl_denomination === 'cent' ? 'cent' : 'usd';
}

/**
 * Map a UTC timestamp to the journal session buckets:
 * Asian 21:00–07:00, London 07:00–12:00, New York 12:00–21:00.
 */
export function sessionFromTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hour = date.getUTCHours();
  if (hour >= 7 && hour < 12) return 'london';
  if (hour >= 12 && hour < 21) return 'ny';
  return 'asian';
}

export function resolvePnlUsd(trade, matchedAccount, source) {
  const isCentAccount = matchedAccount?.pnl_denomination === 'cent';
  const raw = trade.pnl_raw != null ? Number(trade.pnl_raw) : null;
  const fallback = trade.pnl_usd != null ? Number(trade.pnl_usd) : (trade.profit != null ? Number(trade.profit) : 0);
  const val = raw != null ? raw : fallback;

  if (isCentAccount && source === 'investor_bridge') {
    // Investor bridge sends USD dollars — store as cents (×100) for 1:1 cent display.
    return val * 100;
  }

  // EA / API sync already sends account units (cents for cent accounts, dollars for USD).
  return val;
}

/** R-multiple from stop distance; 0 when SL is missing. */
export function rMultiple(trade) {
  const explicit = Number(trade?.r_value);
  if (Number.isFinite(explicit) && Math.abs(explicit) > 0.01) {
    return Math.round(explicit * 100) / 100;
  }
  const entry = Number(trade?.entry_price);
  const exit = Number(trade?.exit_price);
  const sl = Number(trade?.sl_price ?? trade?.sl);
  const pnl = Number(trade?.pnl_usd ?? trade?.pnl_raw ?? 0);
  if (!(entry > 0) || !(sl > 0)) return 0;
  const risk = Math.abs(entry - sl);
  if (!(risk > 0)) return 0;
  const rr = Math.abs(exit - entry) / risk;
  return Math.round((pnl >= 0 ? rr : -rr) * 100) / 100;
}

export function tradesToRows(trades, userId, matchedAccount, source) {
  const accountLabel = matchedAccount.name;
  return trades.map((t) => {
    const pnl = resolvePnlUsd(t, matchedAccount, source);
    const session = t.session === 'asian' || t.session === 'london' || t.session === 'ny'
      ? t.session
      : sessionFromTime(t.open_time || t.close_time);
    const r = rMultiple({ ...t, pnl_usd: pnl });
    const row = {
      user_id: userId,
      source,
      ticket: t.ticket,
      symbol: t.symbol,
      direction: t.direction,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      lot_size: t.lot_size,
      pnl_usd: pnl,
      result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
      session,
      open_time: t.open_time,
      close_time: t.close_time,
      date: (t.close_time || t.open_time || new Date().toISOString()).slice(0, 10),
      account: accountLabel,
      account_id: matchedAccount.id,
    };
    // Skip r_value: 0 so a later sync does not wipe a backfilled / user-set R.
    if (Math.abs(r) > 0.01) row.r_value = r;
    return row;
  });
}

const UPSERT_CHUNK = 200;

export async function upsertSyncedTrades({ trades, userId, matchedAccount, source, supabaseUrl, serviceKey }) {
  const rows = tradesToRows(trades, userId, matchedAccount, source);
  const saved = [];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const res = await fetch(
      `${supabaseUrl}/rest/v1/trades?on_conflict=account_id,ticket`,
      {
        method: 'POST',
        headers: supabaseHeaders(serviceKey, {
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(chunk),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to save trades');
    }
    const body = await res.json();
    if (Array.isArray(body)) saved.push(...body);
  }
  return saved;
}
