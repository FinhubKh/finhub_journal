import { useState, useMemo } from 'react';
import { fmtPnlStrict } from '../../lib/format';
import { toneFromPnl } from '../../lib/dailyPnl';
import { card, cardBody } from '../../lib/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayFirstIndex(dow) { return dow === 0 ? 6 : dow - 1; }
function isWeekendDow(dow) { return dow === 0 || dow === 6; }
function dateString(y, m, d) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

function rowsToMap(rows) {
  const map = {};
  (rows || []).forEach((row) => { if (row?.date) map[row.date] = row; });
  return map;
}

function rowPnl(row) { return Number(row?.pnl) || 0; }
function rowTrades(row) { return Number(row?.trades) || 0; }
function rowWins(row) { return Number(row?.wins) || 0; }
function rowActive(row) { return rowTrades(row) > 0; }

function bucketDailyByMonth(daily, year) {
  const map = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, []]));
  const prefix = `${year}-`;
  for (const row of daily || []) {
    if (!row?.date || !String(row.date).startsWith(prefix)) continue;
    const month = Number(String(row.date).slice(5, 7));
    if (month >= 1 && month <= 12) map[month].push(row);
  }
  return map;
}

function periodTotals(rows) {
  let pnl = 0;
  let trades = 0;
  let wins = 0;
  (rows || []).forEach((row) => {
    pnl += rowPnl(row);
    trades += rowTrades(row);
    wins += rowWins(row);
  });
  return { pnl, trades, wins };
}

function buildMonthWeeks(year, month, dayMap) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let cur = [null, null, null, null, null, null, null];

  function flush() {
    if (!cur.some(Boolean)) return;
    let wPnl = 0;
    let wTrades = 0;
    cur.forEach((ds) => {
      if (!ds) return;
      const row = dayMap[ds];
      wTrades += rowTrades(row);
      wPnl += rowPnl(row);
    });
    const wActive = cur.some((ds) => ds && rowActive(dayMap[ds]));
    weeks.push({ days: [...cur], weekPnl: wPnl, weekTrades: wTrades, weekActive: wActive, index: weeks.length + 1 });
    cur = [null, null, null, null, null, null, null];
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const idx = mondayFirstIndex(dow);
    if (idx === 0) flush();
    cur[idx] = dateString(year, month, d);
  }
  flush();
  return weeks;
}

function weekRangeLabel(days) {
  const inWeek = days.filter(Boolean);
  if (!inWeek.length) return 'Week';
  const s = parseInt(inWeek[0].split('-')[2], 10);
  const e = parseInt(inWeek[inWeek.length - 1].split('-')[2], 10);
  return s === e ? `Day ${s}` : `${s}–${e}`;
}

function cellClass(tone, today, weekend) {
  const base = 'relative flex flex-col rounded-xl border p-2 text-xs transition min-h-[72px]';
  if (tone === 'win') return `${base} border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/30${today ? ' ring-2 ring-violet-400' : ''}`;
  if (tone === 'loss') return `${base} border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30${today ? ' ring-2 ring-rose-400' : ''}`;
  if (tone === 'be') return `${base} border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30${today ? ' ring-2 ring-amber-400' : ''}`;
  if (weekend) return `${base} border-zinc-200 bg-zinc-100 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/60${today ? ' ring-2 ring-violet-400' : ''}`;
  return `${base} border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/60${today ? ' ring-2 ring-violet-400' : ''}`;
}

function miniCellClass(tone, today) {
  const base = 'flex h-5 w-5 items-center justify-center rounded text-[9px] font-medium';
  if (tone === 'win') return `${base} bg-violet-500 text-white`;
  if (tone === 'loss') return `${base} bg-rose-500 text-white`;
  if (tone === 'be') return `${base} bg-amber-400 text-white`;
  if (today) return `${base} ring-1 ring-violet-400 text-zinc-600 dark:text-zinc-300`;
  return `${base} text-zinc-500 dark:text-zinc-400`;
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Profit</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Loss</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />BE</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />No trade</span>
    </div>
  );
}

function MonthCard({ year, month, days, denomination, onSelect }) {
  const dayMap = rowsToMap(days);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];
  const totals = periodTotals(days);
  const hasActivity = totals.trades > 0;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div className="h-5 w-5" key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const row = dayMap[ds];
    const dayPnl = rowPnl(row);
    const active = rowActive(row);
    const tone = toneFromPnl(dayPnl, active);
    const weekend = isWeekendDow(new Date(year, month - 1, d).getDay());
    cells.push(
      <div
        key={ds}
        className={`${miniCellClass(tone, ds === today)} ${weekend && tone === 'none' ? 'text-zinc-300 dark:text-zinc-600' : ''} ${weekend ? 'opacity-70' : ''}`}
        title={active ? fmtPnlStrict(dayPnl, denomination) : weekend ? 'Weekend' : ''}
      >
        {d}
      </div>,
    );
  }

  return (
    <button
      type="button"
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-left transition hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20"
      onClick={() => onSelect(month)}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{MONTHS_SHORT[month - 1]}</div>
        {hasActivity && (
          <div className="text-right text-[10px] leading-tight">
            <div className={totals.pnl >= 0 ? 'font-semibold text-violet-600 dark:text-emerald-400' : 'font-semibold text-rose-600 dark:text-rose-400'}>
              {fmtPnlStrict(totals.pnl, denomination)}
            </div>
            <div className="text-zinc-400">{totals.trades} trade{totals.trades !== 1 ? 's' : ''}</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS.map((d) => <div className="flex h-5 w-5 items-center justify-center text-[8px] font-medium text-zinc-400" key={d}>{d[0]}</div>)}
        {cells}
      </div>
    </button>
  );
}

function YearView({ year, yearDays, denomination, availableYears, onYearChange, onSelectMonth }) {
  const allDays = useMemo(() => Object.values(yearDays).flat(), [yearDays]);
  const totals = periodTotals(allDays);
  const wr = totals.trades > 0 ? Math.round((totals.wins / totals.trades) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 outline-none transition focus:border-violet-500"
          >
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Click a month to see the daily breakdown</p>
        </div>
        {totals.trades > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className={`font-bold tabular-nums ${totals.pnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {fmtPnlStrict(totals.pnl, denomination)}
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">{totals.trades} trades · {wr}% WR</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map((_, i) => (
          <MonthCard
            key={i}
            year={year}
            month={i + 1}
            days={yearDays[i + 1] || []}
            denomination={denomination}
            onSelect={onSelectMonth}
          />
        ))}
      </div>
      <Legend />
    </div>
  );
}

function MonthDetailView({ year, month, monthDays, denomination, onBack, onPrevMonth, onNextMonth }) {
  const today = new Date().toISOString().split('T')[0];
  const totals = periodTotals(monthDays);
  const wr = totals.trades > 0 ? Math.round((totals.wins / totals.trades) * 100) : 0;

  const { weeks, dayMap } = useMemo(() => {
    const map = rowsToMap(monthDays);
    return { weeks: buildMonthWeeks(year, month, map), dayMap: map };
  }, [year, month, monthDays]);

  const bestWeekPnl = weeks.reduce((best, w) => (w.weekActive && w.weekPnl > best ? w.weekPnl : best), -Infinity);
  const bestWeek = bestWeekPnl === -Infinity ? null : weeks.find((w) => w.weekPnl === bestWeekPnl);

  const statItems = [
    { value: totals.trades > 0 ? fmtPnlStrict(totals.pnl, denomination) : '—', label: 'Monthly PnL', coloredPnl: totals.pnl, hasColor: true },
    { value: totals.trades > 0 ? totals.trades : '—', label: 'Trades' },
    { value: totals.trades > 0 ? `${wr}%` : '—', label: 'Win Rate' },
    { value: bestWeek ? fmtPnlStrict(bestWeek.weekPnl, denomination) : '—', label: bestWeek ? `Best week (${weekRangeLabel(bestWeek.days)})` : 'Best week', coloredPnl: bestWeek?.weekPnl, hasColor: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          ← All months
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevMonth} className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-200 dark:hover:bg-zinc-700">Prev</button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">{MONTHS[month - 1]} {year}</h2>
          <button type="button" onClick={onNextMonth} className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-200 dark:hover:bg-zinc-700">Next</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statItems.map(({ value, label, coloredPnl, hasColor }) => (
          <div key={label} className={`${card} p-4 text-center`}>
            <div className={`text-xl font-bold tracking-tight ${hasColor ? (coloredPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-zinc-900 dark:text-zinc-100'}`}>{value}</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
          </div>
        ))}
      </div>

      {totals.trades === 0 ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400 dark:text-zinc-500`}>No trades in this month.</div>
      ) : (
        <div className={card}>
          <div className={cardBody}>
            <div className="mb-2 grid grid-cols-8 gap-2">
              {WEEK_DAYS.map((d) => (
                <div key={d} className={`py-1 text-center text-xs font-semibold ${d === 'Sat' || d === 'Sun' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{d}</div>
              ))}
              <div className="py-1 text-center text-xs font-semibold text-violet-600 dark:text-emerald-400">Week</div>
            </div>
            <div className="space-y-2">
              {weeks.map((week) => (
                <div className="grid grid-cols-8 gap-2" key={week.index}>
                  {week.days.map((ds, idx) => {
                    if (!ds) return <div key={`empty-${week.index}-${idx}`} className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/50" />;
                    const row = dayMap[ds];
                    const dayPnl = rowPnl(row);
                    const count = rowTrades(row);
                    const active = rowActive(row);
                    const tone = toneFromPnl(dayPnl, active);
                    const dayNum = parseInt(ds.split('-')[2], 10);
                    const [dy, dm, dd] = ds.split('-').map(Number);
                    const weekend = isWeekendDow(new Date(dy, dm - 1, dd).getDay());
                    return (
                      <div className={cellClass(tone, ds === today, weekend)} key={ds}>
                        <span className="flex w-full items-start justify-between">
                          <span className={`text-xs font-medium ${weekend ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>{dayNum}</span>
                        </span>
                        {active && (
                          <span className={`mt-auto text-xs font-bold ${dayPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {fmtPnlStrict(dayPnl, denomination)}
                          </span>
                        )}
                        {active && <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{count} trade{count !== 1 ? 's' : ''}</span>}
                      </div>
                    );
                  })}
                  <div className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border p-2 text-center ${
                    !week.weekActive ? 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60'
                      : week.weekPnl >= 0 ? 'border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/30'
                      : 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30'
                  }`}>
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{weekRangeLabel(week.days)}</span>
                    <span className={`mt-1 text-sm font-bold ${!week.weekActive ? 'text-zinc-400 dark:text-zinc-500' : week.weekPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {week.weekActive ? fmtPnlStrict(week.weekPnl, denomination) : '—'}
                    </span>
                    {week.weekTrades > 0 && <span className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">{week.weekTrades} trades</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <Legend />
    </div>
  );
}

export default function PublicCalendar({ daily = [], trades, denomination = 'usd' }) {
  // Prefer cached daily series; fall back to trade rows if an older payload still sends only trades.
  const series = useMemo(() => {
    if (Array.isArray(daily) && daily.length > 0) return daily;
    if (!Array.isArray(trades) || trades.length === 0) return [];
    const byDate = {};
    trades.forEach((t) => {
      if (!t?.date) return;
      const row = byDate[t.date] || { date: t.date, pnl: 0, r_value: 0, trades: 0, wins: 0, losses: 0 };
      row.pnl += Number(t.pnl_usd) || 0;
      row.r_value += Number(t.r_value) || 0;
      row.trades += 1;
      if (t.result === 'win') row.wins += 1;
      if (t.result === 'loss') row.losses += 1;
      byDate[t.date] = row;
    });
    return Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [daily, trades]);

  const availableYears = useMemo(() => {
    const years = new Set(series.map((d) => String(d?.date || '').slice(0, 4)).filter(Boolean).map(Number));
    if (!years.size) years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [series]);

  const [year, setYear] = useState(() => availableYears[0] ?? new Date().getFullYear());
  const [screen, setScreen] = useState('year');
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const yearDays = useMemo(() => bucketDailyByMonth(series, year), [series, year]);
  const monthDays = yearDays[month] || [];

  function openMonth(m) { setMonth(m); setScreen('detail'); }
  function goBack() { setScreen('year'); }
  function prevMonth() { setMonth((m) => { if (m === 1) { setYear((y) => y - 1); return 12; } return m - 1; }); }
  function nextMonth() { setMonth((m) => { if (m === 12) { setYear((y) => y + 1); return 1; } return m + 1; }); }

  if (screen === 'detail') {
    return (
      <MonthDetailView
        year={year}
        month={month}
        monthDays={monthDays}
        denomination={denomination}
        onBack={goBack}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
      />
    );
  }

  return (
    <YearView
      year={year}
      yearDays={yearDays}
      denomination={denomination}
      availableYears={availableYears}
      onYearChange={setYear}
      onSelectMonth={openMonth}
    />
  );
}
