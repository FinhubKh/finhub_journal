export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const EMPTY_YEAR_BUCKETS = Object.freeze(
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, []])),
);

export function bucketDailyByMonth(daily, year) {
  const map = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, []]));
  const prefix = `${year}-`;
  for (const row of daily || []) {
    if (!row?.date || !String(row.date).startsWith(prefix)) continue;
    const month = Number(String(row.date).slice(5, 7));
    if (month >= 1 && month <= 12) map[month].push(row);
  }
  return map;
}

export function rowsToMap(rows) {
  const map = {};
  (rows || []).forEach((row) => { if (row?.date) map[row.date] = row; });
  return map;
}

export function rowPnl(row, override) {
  if (override != null) return Number(override.pnl_usd) || 0;
  return Number(row?.pnl) || 0;
}

export function rowTrades(row, override) {
  if (override != null && override.trade_count != null) {
    return Math.max(0, Number(override.trade_count) || 0);
  }
  return Number(row?.trades) || 0;
}

export function rowActive(row, override) {
  return rowTrades(row, override) > 0 || override != null;
}

export function periodTotals(rows, overrideMap, useOverrides, prefix) {
  const dayMap = rowsToMap(rows);
  const dates = new Set([
    ...Object.keys(dayMap),
    ...(useOverrides ? Object.keys(overrideMap).filter((d) => d.startsWith(prefix)) : []),
  ]);
  let pnl = 0;
  let trades = 0;
  let wins = 0;
  let actualTrades = 0;
  dates.forEach((ds) => {
    const row = dayMap[ds];
    const override = useOverrides ? overrideMap[ds] : null;
    pnl += rowPnl(row, override);
    trades += rowTrades(row, override);
    wins += Number(row?.wins) || 0;
    actualTrades += Number(row?.trades) || 0;
  });
  return { pnl, trades, wins, actualTrades };
}

export function isWeekendDow(dow) {
  return dow === 0 || dow === 6;
}

/** Monday-first index: Mon=0 … Sun=6 */
export function mondayFirstIndex(dow) {
  return dow === 0 ? 6 : dow - 1;
}

export function isWeekendDateString(ds) {
  if (!ds) return false;
  const [y, m, d] = ds.split('-').map(Number);
  return isWeekendDow(new Date(y, m - 1, d).getDay());
}

export function cellClass(tone, today, tall = false, weekend = false) {
  const base = `relative flex flex-col rounded-xl border p-2 text-xs transition ${tall ? 'h-full overflow-hidden' : 'min-h-[72px]'}`;
  if (tone === 'win') {
    return `${base} border-violet-200 bg-violet-50 ${weekend ? 'opacity-80' : ''} ${today ? 'ring-2 ring-violet-400' : ''}`;
  }
  if (tone === 'loss') {
    return `${base} border-rose-200 bg-rose-50 ${weekend ? 'opacity-80' : ''} ${today ? 'ring-2 ring-rose-400' : ''}`;
  }
  if (tone === 'be') {
    return `${base} border-amber-200 bg-amber-50 ${weekend ? 'opacity-80' : ''} ${today ? 'ring-2 ring-amber-400' : ''}`;
  }
  if (weekend) {
    return `${base} border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-500 ${today ? 'ring-2 ring-violet-400' : ''}`;
  }
  return `${base} border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${today ? 'ring-2 ring-violet-400' : ''}`;
}

export function miniCellClass(tone, today) {
  const base = 'flex h-5 w-5 items-center justify-center rounded text-[9px] font-medium';
  if (tone === 'win') return `${base} bg-violet-500 text-white`;
  if (tone === 'loss') return `${base} bg-rose-500 text-white`;
  if (tone === 'be') return `${base} bg-amber-400 text-white`;
  if (today) return `${base} ring-1 ring-violet-400 text-zinc-600 dark:text-zinc-300`;
  return `${base} text-zinc-500 dark:text-zinc-400`;
}

export function dateString(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function summarizeWeek(days, dayMap, overrideMap, useOverrides) {
  let weekPnl = 0;
  let weekTrades = 0;
  days.forEach((ds) => {
    if (!ds) return;
    const row = dayMap[ds];
    const override = useOverrides ? overrideMap[ds] : null;
    weekTrades += rowTrades(row, override);
    weekPnl += rowPnl(row, override);
  });
  return {
    weekPnl,
    weekTrades,
    weekActive: days.some((ds) => ds && rowActive(dayMap[ds], useOverrides ? overrideMap[ds] : null)),
  };
}

export function buildMonthWeeks(year, month, dayMap, overrideMap, useOverrides) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeek = [null, null, null, null, null, null, null];

  function flushWeek() {
    if (!currentWeek.some(Boolean)) return;
    const { weekPnl, weekTrades, weekActive } = summarizeWeek(currentWeek, dayMap, overrideMap, useOverrides);
    weeks.push({ days: [...currentWeek], weekPnl, weekTrades, weekActive, index: weeks.length + 1 });
    currentWeek = [null, null, null, null, null, null, null];
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const weekdayIndex = mondayFirstIndex(dow);
    if (weekdayIndex === 0) flushWeek();
    currentWeek[weekdayIndex] = dateString(year, month, d);
  }

  flushWeek();
  return weeks;
}

export function weekRangeLabel(days) {
  const inWeek = days.filter(Boolean);
  if (inWeek.length === 0) return 'Week';
  const start = parseInt(inWeek[0].split('-')[2], 10);
  const end = parseInt(inWeek[inWeek.length - 1].split('-')[2], 10);
  return start === end ? `Day ${start}` : `${start}–${end}`;
}

export function monthPrefix(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function yearsFromDates(rows, fallbackYear = new Date().getFullYear()) {
  const years = new Set();
  for (const row of rows || []) {
    const y = Number(String(row?.date || '').slice(0, 4));
    if (y >= 1990 && y <= 2100) years.add(y);
  }
  if (years.size === 0) years.add(fallbackYear);
  return [...years].sort((a, b) => a - b);
}
