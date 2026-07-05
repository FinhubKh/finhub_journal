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

export function computeStats(trades) {
  if (trades.length === 0) return null;

  const wins = trades.filter((t) => t.result === 'win');
  const losses = trades.filter((t) => t.result === 'loss');
  const total = trades.length;
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const totalR = trades.reduce((s, t) => s + (t.r_value || 0), 0);
  const wr = Math.round((wins.length / total) * 100);
  const avgR = totalR / total;

  const grossWin = wins.reduce((s, t) => s + (t.pnl_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl_usd || 0), 0));
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? '∞' : '—';

  const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + (t.r_value || 0), 0) / wins.length : 0;
  const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.r_value || 0), 0) / losses.length) : 0;
  const rrRatio = avgLossR > 0 ? (avgWinR / avgLossR).toFixed(2) : avgWinR > 0 ? '∞' : '—';

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
    const k = t[groupKey] ? t[groupKey].charAt(0).toUpperCase() + t[groupKey].slice(1) : 'Other';
    if (!groups[k]) groups[k] = { wins: 0, losses: 0, be: 0, pnl: 0, r: 0 };
    groups[k][t.result === 'win' ? 'wins' : t.result === 'loss' ? 'losses' : 'be']++;
    groups[k].pnl += t.pnl_usd || 0;
    groups[k].r += t.r_value || 0;
  });
  return groups;
}
