import { SUPABASE_URL, authHeaders, getToken, getUserId, authFetch } from './auth';

function mapAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    startingBalance: Number(row.starting_balance),
    targetBalance: Number(row.target_balance),
    targetProfitPercent: Number(row.target_profit_percent),
    riskPercent: Number(row.risk_percent),
    riskRewardRatio: row.risk_reward_ratio != null ? Number(row.risk_reward_ratio) : 3,
    stopLossPips: row.stop_loss_pips != null ? Number(row.stop_loss_pips) : undefined,
    stopLossPoints: row.stop_loss_points != null ? Number(row.stop_loss_points) : undefined,
    lotSizeMethod: row.lot_size_method || 'fixed_risk_pips',
    pipValuePerLot: Number(row.pip_value_per_lot ?? 10),
    pointValuePerLot: Number(row.point_value_per_lot ?? 1),
    plSource: row.pl_source || 'calculated',
    tradingAccountId: row.trading_account_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrade(row) {
  if (!row) return null;
  return {
    id: row.id,
    tradeNumber: row.trade_number,
    date: row.date,
    balanceBefore: 0,
    suggestedLotSize: 0,
    riskAmount: 0,
    targetProfit: 0,
    result: row.result,
    actualPL: row.actual_pl != null ? Number(row.actual_pl) : 0,
    balanceAfter: 0,
    notes: row.notes || '',
    useManualPL: row.use_manual_pl === true,
    calendarTrades: row.calendar_trades ?? undefined,
    calendarWinTrades: row.calendar_win_trades ?? undefined,
    calendarLossTrades: row.calendar_loss_trades ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function accountToDb(fields) {
  const out = {};
  if (fields.name !== undefined) out.name = fields.name;
  if (fields.startingBalance !== undefined) out.starting_balance = fields.startingBalance;
  if (fields.targetBalance !== undefined) out.target_balance = fields.targetBalance;
  if (fields.targetProfitPercent !== undefined) out.target_profit_percent = fields.targetProfitPercent;
  if (fields.riskPercent !== undefined) out.risk_percent = fields.riskPercent;
  if (fields.riskRewardRatio !== undefined) out.risk_reward_ratio = fields.riskRewardRatio;
  if (fields.stopLossPips !== undefined) out.stop_loss_pips = fields.stopLossPips || null;
  if (fields.stopLossPoints !== undefined) out.stop_loss_points = fields.stopLossPoints || null;
  if (fields.lotSizeMethod !== undefined) out.lot_size_method = fields.lotSizeMethod;
  if (fields.pipValuePerLot !== undefined) out.pip_value_per_lot = fields.pipValuePerLot;
  if (fields.pointValuePerLot !== undefined) out.point_value_per_lot = fields.pointValuePerLot;
  if (fields.plSource !== undefined) out.pl_source = fields.plSource;
  if (fields.tradingAccountId !== undefined) out.trading_account_id = fields.tradingAccountId || null;
  return out;
}

export async function fetchCompoundingAccounts() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/compounding_accounts?select=*&order=created_at.desc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(await res.text());
  }
  return (await res.json()).map(mapAccount);
}

export async function fetchCompoundingAccount(id) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/compounding_accounts?id=eq.${id}&select=*`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return mapAccount(rows[0]);
}

export async function insertCompoundingAccount(account) {
  const body = {
    ...accountToDb(account),
    user_id: getUserId(),
    updated_at: new Date().toISOString(),
  };
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/compounding_accounts`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return mapAccount(rows[0]);
}

export async function updateCompoundingAccount(id, fields) {
  const body = {
    ...accountToDb(fields),
    updated_at: new Date().toISOString(),
  };
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/compounding_accounts?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return mapAccount(rows[0]);
}

export async function deleteCompoundingAccount(id) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/compounding_accounts?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function fetchCompoundingTrades(accountId) {
  const PAGE_SIZE = 1000;
  const out = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const res = await authFetch(
      `${SUPABASE_URL}/rest/v1/compounding_trades?compounding_account_id=eq.${accountId}&select=*&order=trade_number.asc`,
      {
        headers: {
          ...authHeaders(getToken()),
          Range: `${from}-${to}`,
          Prefer: 'count=exact',
        },
      },
    );
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(await res.text());
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return out.map(mapTrade);
}

export async function insertCompoundingTrade(accountId, trade) {
  const body = {
    user_id: getUserId(),
    compounding_account_id: accountId,
    trade_number: trade.tradeNumber,
    date: trade.date,
    result: trade.result,
    notes: trade.notes ?? '',
    use_manual_pl: trade.useManualPL === true,
    updated_at: new Date().toISOString(),
  };
  if (trade.useManualPL && trade.actualPL !== undefined) body.actual_pl = trade.actualPL;
  if (trade.calendarTrades !== undefined) body.calendar_trades = trade.calendarTrades;
  if (trade.calendarWinTrades !== undefined) body.calendar_win_trades = trade.calendarWinTrades;
  if (trade.calendarLossTrades !== undefined) body.calendar_loss_trades = trade.calendarLossTrades;

  const res = await authFetch(`${SUPABASE_URL}/rest/v1/compounding_trades`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return mapTrade(rows[0]);
}

export async function updateCompoundingTrade(id, fields) {
  const body = { updated_at: new Date().toISOString() };
  if (fields.result !== undefined) body.result = fields.result;
  if (fields.date !== undefined) body.date = fields.date;
  if (fields.notes !== undefined) body.notes = fields.notes;
  if (fields.useManualPL !== undefined) body.use_manual_pl = fields.useManualPL;
  if (fields.actualPL !== undefined) body.actual_pl = fields.actualPL;
  if (fields.tradeNumber !== undefined) body.trade_number = fields.tradeNumber;
  if (fields.calendarTrades !== undefined) body.calendar_trades = fields.calendarTrades;
  if (fields.calendarWinTrades !== undefined) body.calendar_win_trades = fields.calendarWinTrades;
  if (fields.calendarLossTrades !== undefined) body.calendar_loss_trades = fields.calendarLossTrades;

  const res = await authFetch(`${SUPABASE_URL}/rest/v1/compounding_trades?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return mapTrade(rows[0]);
}

export async function deleteCompoundingTrade(id) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/compounding_trades?id=eq.${id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteAllCompoundingTrades(accountId) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/compounding_trades?compounding_account_id=eq.${accountId}`,
    { method: 'DELETE', headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
}
