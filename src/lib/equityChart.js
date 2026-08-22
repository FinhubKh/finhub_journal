import { toDisplayPnl } from './format';

export function formatDayLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Prefer daily buckets; otherwise collapse trades into one point per calendar day. */
export function pointsFromProps(daily, trades) {
  if (Array.isArray(daily) && daily.length > 0) {
    return daily.map((d) => ({
      date: d.date,
      pnl: Number(d.pnl) || 0,
      r_value: Number(d.r_value) || 0,
    }));
  }

  const byDate = new Map();
  for (const t of trades || []) {
    const date = t.date;
    if (!date) continue;
    const existing = byDate.get(date) || { date, pnl: 0, r_value: 0 };
    existing.pnl += Number(t.pnl_usd) || 0;
    existing.r_value += Number(t.r_value) || 0;
    byDate.set(date, existing);
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * Build Chart.js labels + cumulative equity series.
 * Always prepends a Start anchor so a single trading day still draws a line.
 */
export function buildSeries(points, denomination, initialDeposit = 0) {
  const sorted = [...points].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const labels = [];
  const dataUsd = [];
  const peakUsd = [];
  let cumUsd = Number(initialDeposit) || 0;
  let peak = cumUsd;

  if (sorted.length > 0) {
    labels.push('Start');
    dataUsd.push(parseFloat(cumUsd.toFixed(2)));
    peakUsd.push(parseFloat(peak.toFixed(2)));
  }

  for (const t of sorted) {
    cumUsd += toDisplayPnl(t.pnl || 0, denomination);
    if (cumUsd > peak) peak = cumUsd;
    labels.push(formatDayLabel(t.date));
    dataUsd.push(parseFloat(cumUsd.toFixed(2)));
    peakUsd.push(parseFloat(peak.toFixed(2)));
  }

  return { labels, dataUsd, peakUsd };
}

/** Starting equity before trade PnL: balance − net result (falls back to deposits). */
export function startingEquityFromStats(stats) {
  if (!stats) return 0;
  if (stats.balance != null && Number.isFinite(Number(stats.balance))) {
    return Number(stats.balance) - (Number(stats.totalPnl) || 0);
  }
  return Number(stats.deposits) || 0;
}
