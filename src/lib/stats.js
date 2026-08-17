export function calcStreaks(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let bestStreak = 0, worstStreak = 0, curWin = 0, curLoss = 0;
  sorted.forEach((t) => {
    if (t.result === 'win') { curWin++; curLoss = 0; bestStreak = Math.max(bestStreak, curWin); }
    else if (t.result === 'loss') { curLoss++; curWin = 0; worstStreak = Math.max(worstStreak, curLoss); }
    else { curWin = 0; curLoss = 0; }
  });
  return { bestStreak, worstStreak };
}

function tradeHasExplicitR(t) {
  return Math.abs(Number(t.r_value) || 0) > 0.01;
}

export function computeStats(trades) {
  if (trades.length === 0) return null;

  const wins = trades.filter((t) => t.result === 'win');
  const losses = trades.filter((t) => t.result === 'loss');
  const total = trades.length;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const wr = Math.round((wins.length / total) * 100);
  const grossWin = wins.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl_usd || 0), 0));
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? '∞' : '—';

  const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const rrRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? '∞' : '—';

  // Per-trade R: use explicit r_value when set; otherwise derive from avg loss / PnL.
  const totalR = trades.reduce((s, t) => {
    if (tradeHasExplicitR(t)) return s + Number(t.r_value);
    if (avgLoss > 0) return s + ((t.pnl_usd || 0) / avgLoss);
    return s;
  }, 0);
  const avgR = total ? totalR / total : 0;

  const lr = losses.length / total;
  const expectancy = (wr / 100) * avgWin - lr * avgLoss;

  const { bestStreak, worstStreak } = calcStreaks(trades);

  const sortedByDate = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let cum = 0, peak = 0, maxDD = 0;
  sortedByDate.forEach((t) => {
    cum += t.pnl_usd || 0;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    total, wins, losses, totalPnl, avgR, wr, pf, avgWin, avgLoss, rrRatio,
    expectancy, bestStreak, worstStreak, maxDD,
  };
}

export function buildPerfGroups(trades, groupKey) {
  const groups = {};
  trades.forEach((t) => {
    const key = t[groupKey] || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups).map(([name, list]) => ({
    name,
    count: list.length,
    pnl: list.reduce((s, t) => s + (t.pnl_usd || 0), 0),
    wr: Math.round((list.filter((t) => t.result === 'win').length / list.length) * 100),
  })).sort((a, b) => b.pnl - a.pnl);
}
