/** 'calm' | 'elevated' | 'alert', from the trailing streak and drawdown vs half-Kelly. */
export function computeRiskState(summary) {
  const streak = summary?.streaks?.current_streak;
  const lossCount = streak?.type === 'loss' ? streak.count : 0;
  const drawdownPct = summary?.max_drawdown?.pct ?? 0;
  const kellyPct = summary?.kelly_half_pct;

  if (kellyPct != null && kellyPct > 0) {
    if (lossCount >= 4 || drawdownPct >= kellyPct * 2) return 'alert';
    if (lossCount >= 2 || drawdownPct >= kellyPct) return 'elevated';
    return 'calm';
  }

  if (lossCount >= 4) return 'alert';
  if (lossCount >= 2) return 'elevated';
  return 'calm';
}

/** Current-period win rate as a % of the previous period's, or no comparison if there's nothing to compare against. */
export function computePeriodPacing(currentSummary, previousSummary) {
  const prevWinRate = previousSummary?.win_rate;
  const prevCount = previousSummary?.trade_count || 0;
  if (!previousSummary || prevCount === 0 || !prevWinRate || prevWinRate <= 0) {
    return { hasComparison: false, pct: null };
  }
  const curWinRate = currentSummary?.win_rate || 0;
  return { hasComparison: true, pct: Math.round((curWinRate / prevWinRate) * 100) };
}

/** How many of the most recent `windowSize` trades (newest first) consecutively used a defined entry model. */
export function computeModelDisciplineStreak(sampleTrades, windowSize = 5) {
  const trades = Array.isArray(sampleTrades) ? sampleTrades.slice(0, windowSize) : [];
  let count = 0;
  for (const t of trades) {
    if (t?.model) count += 1;
    else break;
  }
  return { count, total: trades.length };
}

/** The immediately preceding date range of the same length, for period-over-period pacing. */
export function computePreviousPeriod(from, to) {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const spanMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}
