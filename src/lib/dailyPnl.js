export function tradesSumForDay(trades) {
  return trades.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0);
}

export function resolveDayTradeCount(trades, override) {
  if (override != null && override.trade_count != null) {
    return Math.max(0, Number(override.trade_count) || 0);
  }
  return trades.length;
}

export function toneFromPnl(pnl, active) {
  if (!active) return 'none';
  if (pnl > 0) return 'win';
  if (pnl < 0) return 'loss';
  return 'be';
}

export function overridesToMap(rows) {
  const map = {};
  rows.forEach((row) => { map[row.date] = row; });
  return map;
}
