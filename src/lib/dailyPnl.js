export function tradesSumForDay(trades) {
  return trades.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0);
}

export function resolveDayPnl(trades, override) {
  if (override != null) return Number(override.pnl_usd) || 0;
  return tradesSumForDay(trades);
}

export function resolveDayTradeCount(trades, override) {
  if (override != null && override.trade_count != null) {
    return Math.max(0, Number(override.trade_count) || 0);
  }
  return trades.length;
}

export function dayHasActivity(trades, override) {
  return trades.length > 0 || override != null;
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

export function monthTradeTotal(trades, overrideMap, useOverrides, year, month) {
  if (!useOverrides) return trades.length;

  const tradeMap = {};
  trades.forEach((t) => { (tradeMap[t.date] ||= []).push(t); });
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const dates = new Set([
    ...trades.map((t) => t.date),
    ...Object.keys(overrideMap).filter((d) => d.startsWith(prefix)),
  ]);

  let total = 0;
  dates.forEach((ds) => {
    total += resolveDayTradeCount(tradeMap[ds] || [], overrideMap[ds]);
  });
  return total;
}

export function yearTradeTotal(allTrades, overrideMap, useOverrides, year) {
  if (!useOverrides) return allTrades.length;

  const tradeMap = {};
  allTrades.forEach((t) => { (tradeMap[t.date] ||= []).push(t); });
  const prefix = `${year}-`;
  const dates = new Set([
    ...allTrades.map((t) => t.date),
    ...Object.keys(overrideMap).filter((d) => d.startsWith(prefix)),
  ]);

  let total = 0;
  dates.forEach((ds) => {
    total += resolveDayTradeCount(tradeMap[ds] || [], overrideMap[ds]);
  });
  return total;
}
