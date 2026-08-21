/**
 * Build a compact performance summary for the AI advisor.
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

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function sampleStdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function downsideDeviation(arr) {
  const downside = arr.filter((x) => x < 0);
  if (downside.length < 2) return 0;
  const variance = downside.reduce((s, x) => s + x ** 2, 0) / downside.length;
  return Math.sqrt(variance);
}

/** Trade-level Sharpe on the R-multiple series. Not an annualized fund Sharpe. */
export function calcSharpe(rValues) {
  if (!Array.isArray(rValues) || rValues.length < 2) return null;
  const sd = sampleStdev(rValues);
  if (sd === 0) return null;
  return round(mean(rValues) / sd, 2);
}

/** Trade-level Sortino: mean R over downside deviation of losing trades only. */
export function calcSortino(rValues) {
  if (!Array.isArray(rValues) || rValues.length < 2) return null;
  const dd = downsideDeviation(rValues);
  if (dd === 0) return null;
  return round(mean(rValues) / dd, 2);
}

/** Peak-to-trough decline on the cumulative-PnL equity curve, in $ and % of peak. */
export function calcMaxDrawdown(trades) {
  const list = Array.isArray(trades) ? trades : [];
  if (list.length < 2) return { usd: 0, pct: 0 };
  const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let cumulative = 0;
  let peak = 0;
  let maxDrawdownUsd = 0;
  let peakAtMaxDrawdown = 0;
  for (const t of sorted) {
    cumulative += Number(t.pnl_usd) || 0;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdownUsd) {
      maxDrawdownUsd = drawdown;
      peakAtMaxDrawdown = peak;
    }
  }
  const pct = peakAtMaxDrawdown > 0 ? (maxDrawdownUsd / peakAtMaxDrawdown) * 100 : 0;
  return { usd: round(maxDrawdownUsd), pct: round(pct, 1) };
}

/** Half-Kelly suggested risk-per-trade percentage from win rate + payoff ratio. */
export function calcKellyHalf(winRatePct, payoffRatio) {
  if (!Number.isFinite(payoffRatio) || payoffRatio <= 0) return null;
  const p = Number(winRatePct) / 100;
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  const f = p - (1 - p) / payoffRatio;
  const clamped = Math.max(0, Math.min(1, f));
  return round((clamped / 2) * 100, 1);
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

function slimGroup(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, MAX_GROUP_KEYS).map((g) => ({
    name: g.name,
    trades: g.trades,
    wins: g.wins,
    losses: g.losses,
    wr: g.win_rate,
    pnl: g.pnl,
    avg_r: g.avg_r,
  }));
}

/** Rich stats brief for SEA-LION advising (still no trade notes). */
export function buildAdvisorBrief(summary) {
  const s = summary || {};
  return {
    account: s.account_name || null,
    range: { from: s.from_date, to: s.to_date },
    overview: {
      trades: s.trade_count,
      wins: s.wins,
      losses: s.losses,
      breakeven: s.breakeven,
      win_rate_pct: s.win_rate,
      net_pnl: s.net_pnl,
      avg_r: s.avg_r,
      avg_win: s.avg_win,
      avg_loss: s.avg_loss,
      payoff_ratio: s.payoff_ratio,
      expectancy: s.expectancy,
      profit_factor: s.profit_factor,
      sharpe: s.sharpe,
      sortino: s.sortino,
      max_drawdown: s.max_drawdown,
      kelly_half_pct: s.kelly_half_pct,
    },
    streaks: s.streaks,
    by_session: slimGroup(s.by_session),
    by_symbol: slimGroup(s.by_symbol),
    by_model: slimGroup(s.by_model),
    by_direction: slimGroup(s.by_direction),
    by_weekday: slimGroup(s.by_weekday),
    best_trade: s.best_trade,
    worst_trade: s.worst_trade,
    recent_trades: (s.sample_trades || []).slice(0, 15),
  };
}

/** Instant insights from stats — no LLM wait on Get analysis. */
export function buildStatsInsights(summary, language = 'en') {
  const s = summary || {};
  const km = language === 'km';
  const insights = [];
  const push = (title, detail, tone) => {
    if (insights.length >= 5) return;
    insights.push({ title, detail, tone });
  };

  if (s.trade_count > 0) {
    if (s.win_rate >= 55) {
      push(
        km ? 'Solid win rate' : 'Solid win rate',
        km
          ? `Win rate ${s.win_rate}% across ${s.trade_count} trades. Keep the same filter.`
          : `Win rate is ${s.win_rate}% across ${s.trade_count} trades. Keep the same selection filter.`,
        'positive',
      );
    } else if (s.win_rate < 45) {
      push(
        km ? 'Win rate is soft' : 'Win rate is soft',
        km
          ? `Win rate ${s.win_rate}%. Tighten entries and skip marginal setups.`
          : `Win rate is ${s.win_rate}%. Tighten entries and skip marginal setups.`,
        'warning',
      );
    }
  }

  if (Number(s.expectancy) > 0) {
    push(
      'Positive expectancy',
      km
        ? `Expectancy ~${s.expectancy} per trade. Keep risk size consistent.`
        : `Expectancy is about ${s.expectancy} per trade. Keep risk size consistent.`,
      'positive',
    );
  } else if (Number(s.expectancy) < 0) {
    push(
      'Negative expectancy',
      km
        ? `Expectancy ${s.expectancy}. Review exits and avg loss (${s.avg_loss}).`
        : `Expectancy is ${s.expectancy}. Review exits and average loss size (${s.avg_loss}).`,
      'warning',
    );
  }

  const sessions = Array.isArray(s.by_session) ? s.by_session : [];
  if (sessions.length > 0) {
    const best = [...sessions].sort((a, b) => b.pnl - a.pnl)[0];
    const worst = [...sessions].sort((a, b) => a.pnl - b.pnl)[0];
    if (best && best.pnl > 0) {
      push(
        `Strong session: ${best.name}`,
        km
          ? `${best.name} made ${best.pnl} (WR ${best.win_rate}%). Bias toward this window.`
          : `${best.name} made ${best.pnl} (WR ${best.win_rate}%). Bias size toward this window.`,
        'positive',
      );
    }
    if (worst && worst.pnl < 0 && worst.name !== best?.name) {
      push(
        `Weak session: ${worst.name}`,
        km
          ? `${worst.name} lost ${worst.pnl}. Cut size or stand aside.`
          : `${worst.name} lost ${worst.pnl}. Cut size or stand aside there.`,
        'warning',
      );
    }
  }

  const symbols = Array.isArray(s.by_symbol) ? s.by_symbol : [];
  if (symbols.length > 0) {
    const top = symbols[0];
    if (top?.trades >= 3) {
      push(
        `Key symbol: ${top.name}`,
        `${top.name}: ${top.trades} trades, PnL ${top.pnl}, WR ${top.win_rate}%.`,
        top.pnl >= 0 ? 'positive' : 'warning',
      );
    }
  }

  const streaks = s.streaks || {};
  if ((streaks.worst_loss_streak || 0) >= 3) {
    push(
      'Long losing streak',
      km
        ? `Worst loss streak ${streaks.worst_loss_streak}. Pause after 2-3 losses.`
        : `Worst loss streak is ${streaks.worst_loss_streak}. Add a pause rule after 2-3 losses.`,
      'warning',
    );
  } else if ((streaks.best_win_streak || 0) >= 3) {
    push(
      'Healthy win streak',
      km
        ? `Best win streak ${streaks.best_win_streak}. Avoid sizing up mid-streak.`
        : `Best win streak is ${streaks.best_win_streak}. Avoid sizing up mid-streak.`,
      'neutral',
    );
  }

  if (insights.length === 0) {
    push(
      'Data ready',
      km
        ? `${s.trade_count || 0} trades in range. Use the report for next steps.`
        : `${s.trade_count || 0} trades in range. Use the report for a concrete action plan.`,
      'neutral',
    );
  }

  return insights;
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
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : null;

  const rValues = list.map((t) => Number(t.r_value) || 0);
  const sharpe = calcSharpe(rValues);
  const sortino = calcSortino(rValues);
  const maxDrawdown = calcMaxDrawdown(list);
  const kellyHalfPct = calcKellyHalf(wr, payoffRatio);

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byWeekday = groupBy(list, (t) => {
    const d = new Date(`${String(t.date).slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return 'Other';
    return weekdayNames[d.getUTCDay()];
  });

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
    payoff_ratio: payoffRatio == null ? null : round(payoffRatio),
    expectancy: round(expectancy),
    profit_factor: grossLoss > 0 ? round(grossWin / grossLoss) : (grossWin > 0 ? null : 0),
    sharpe,
    sortino,
    max_drawdown: maxDrawdown,
    kelly_half_pct: kellyHalfPct,
    streaks: calcStreaks(list),
    by_session: groupBy(list, (t) => t.session),
    by_symbol: groupBy(list, (t) => t.symbol),
    by_model: groupBy(list, (t) => t.model),
    by_direction: groupBy(list, (t) => t.direction),
    by_weekday: byWeekday,
    best_trade: best
      ? { date: best.date, symbol: best.symbol, pnl_usd: round(best.pnl_usd), r_value: round(best.r_value) }
      : null,
    worst_trade: worst
      ? { date: worst.date, symbol: worst.symbol, pnl_usd: round(worst.pnl_usd), r_value: round(worst.r_value) }
      : null,
    sample_trades: sample,
  };
}
