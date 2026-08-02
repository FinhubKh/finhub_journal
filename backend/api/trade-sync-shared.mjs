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

export function resolvePnlUsd(trade, matchedAccount) {
  const raw = trade.pnl_raw != null ? Number(trade.pnl_raw) : null;
  const fallback = Number(trade.pnl_usd) || 0;
  const denom = accountDenomination(matchedAccount);

  if (raw != null) {
    return denom === 'cent' ? raw / 100 : raw;
  }
  return fallback;
}

export function tradesToRows(trades, userId, matchedAccount, source) {
  const accountLabel = matchedAccount.name;
  return trades.map((t) => {
    const pnl = resolvePnlUsd(t, matchedAccount);
    return {
      user_id: userId,
      source,
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
}

export async function upsertSyncedTrades({ trades, userId, matchedAccount, source, supabaseUrl, serviceKey }) {
  const rows = tradesToRows(trades, userId, matchedAccount, source);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/trades?on_conflict=user_id,ticket`,
    {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, {
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to save trades');
  }
  return res.json();
}
