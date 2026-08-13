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

export function resolvePnlUsd(trade, matchedAccount, source) {
  const isCentAccount = matchedAccount?.pnl_denomination === 'cent';
  const raw = trade.pnl_raw != null ? Number(trade.pnl_raw) : null;
  const fallback = trade.pnl_usd != null ? Number(trade.pnl_usd) : (trade.profit != null ? Number(trade.profit) : 0);

  if (isCentAccount) {
    // Investor password bridge (MetaApi) sends values in USD dollars (e.g. 54.83).
    // Scale USD dollars to Cents (* 100) so FinhubKH stores 5483.00 cents 1:1!
    if (source === 'investor_bridge') {
      const val = raw != null ? raw : fallback;
      return val * 100;
    }
    // EA sync or Manual entry: values are already sent 1:1 in Cents (e.g. 5483.00)
    if (raw != null) return raw;
    return fallback;
  }

  // USD Account: values are in USD dollars (e.g. 54.83)
  if (raw != null) return raw;
  return fallback;
}

export function tradesToRows(trades, userId, matchedAccount, source) {
  const accountLabel = matchedAccount.name;
  return trades.map((t) => {
    const pnl = resolvePnlUsd(t, matchedAccount, source);
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
