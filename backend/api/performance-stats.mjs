/**
 * Build a compact performance summary for the AI coach.
 * No trade notes are included.
 */

const MAX_SAMPLE = 20;
const MAX_GROUP_KEYS = 8;

function round(n, digits = 2) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const p = 10 ** digits;
  return Math.round(x * p) / p;
}

function groupBy(trades, keyFn) {
  const groups = {};
  for (const t of trades) {
    const raw = keyFn(t);
    const k = String(raw || 'Other').trim() || 'Other';
    if (!groups[k]) groups[k] = { trades: 0, wins: 0, losses: 0, be: 0, pnl: 0, r: 0 };
    groups[k].trades += 1;
    if (t.result === 'win') groups[k].wins += 1;
    else if (t.result === 'loss') groups[k].losses += 1;
    else groups[k].be += 1;
    groups[k].pnl += Number(t.pnl_usd) || 0;
    groups[k].r += Number(t.r_value) || 0;
  }

  return Object.entries(groups)
    .map(([name, g]) => ({
      name,
      trades: g.trades,
      wins: g.wins,
      losses: g.losses,
      be: g.be,
      pnl: round(g.pnl),
      avg_r: g.trades ? round(g.r / g.trades) : 0,
      win_rate: g.trades ? round((g.wins / g.trades) * 100, 1) : 0,
    }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, MAX_GROUP_KEYS);
}

function calcStreaks(trades) {
  const sorted = [...trades].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let bestWin = 0;
  let worstLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of sorted) {
    if (t.result === 'win') {
      curWin += 1;
      curLoss = 0;
      bestWin = Math.max(bestWin, curWin);
    } else if (t.result === 'loss') {
      curLoss += 1;
      curWin = 0;
      worstLoss = Math.max(worstLoss, curLoss);
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }
  return { best_win_streak: bestWin, worst_loss_streak: worstLoss };
}

export function buildPerformanceSummary(trades, meta = {}) {
  const list = Array.isArray(trades) ? trades : [];
  const wins = list.filter((t) => t.result === 'win');
  const losses = list.filter((t) => t.result === 'loss');
  const total = list.length;
  const totalPnl = list.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0);
  const totalR = list.reduce((s, t) => s + (Number(t.r_value) || 0), 0);
  const wr = total ? (wins.length / total) * 100 : 0;
  const avgR = total ? totalR / total : 0;
  const grossWin = wins.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.pnl_usd) || 0), 0));
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = total ? (wr / 100) * avgWin - ((losses.length / total) * avgLoss) : 0;

  const sortedByPnl = [...list].sort((a, b) => (Number(b.pnl_usd) || 0) - (Number(a.pnl_usd) || 0));
  const best = sortedByPnl[0];
  const worst = sortedByPnl[sortedByPnl.length - 1];

  const sample = [...list]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, MAX_SAMPLE)
    .map((t) => ({
      date: t.date,
      symbol: t.symbol || null,
      direction: t.direction || null,
      result: t.result || null,
      r_value: round(t.r_value),
      pnl_usd: round(t.pnl_usd),
      session: t.session || null,
      model: t.model || null,
    }));

  return {
    account_id: meta.account_id || null,
    account_name: meta.account_name || null,
    from_date: meta.from_date || null,
    to_date: meta.to_date || null,
    trade_count: total,
    wins: wins.length,
    losses: losses.length,
    breakeven: total - wins.length - losses.length,
    win_rate: round(wr, 1),
    net_pnl: round(totalPnl),
    avg_r: round(avgR),
    avg_win: round(avgWin),
    avg_loss: round(avgLoss),
    expectancy: round(expectancy),
    profit_factor: grossLoss > 0 ? round(grossWin / grossLoss) : (grossWin > 0 ? null : 0),
    streaks: calcStreaks(list),
    by_session: groupBy(list, (t) => t.session),
    by_symbol: groupBy(list, (t) => t.symbol),
    by_model: groupBy(list, (t) => t.model),
    by_direction: groupBy(list, (t) => t.direction),
    best_trade: best
      ? { date: best.date, symbol: best.symbol, pnl_usd: round(best.pnl_usd), r_value: round(best.r_value) }
      : null,
    worst_trade: worst
      ? { date: worst.date, symbol: worst.symbol, pnl_usd: round(worst.pnl_usd), r_value: round(worst.r_value) }
      : null,
    sample_trades: sample,
  };
}
