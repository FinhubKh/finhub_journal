import { useEffect, useState, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { fetchDailyPnlByYear } from '../api';
import { viewPnlDenomination } from '../lib/accounts';
import { fmtPnlStrict } from '../lib/format';
import AccountViewDropdown from '../components/layout/AccountViewDropdown';
import {
  dayHasActivity,
  overridesToMap,
  resolveDayPnl,
  resolveDayTradeCount,
  toneFromPnl,
  tradesSumForDay,
  monthTradeTotal,
  yearTradeTotal,
} from '../lib/dailyPnl';
import DailyPnlModal from '../components/modals/DailyPnlModal';
import YearDropdown from '../components/common/YearDropdown';
import BackButton from '../components/common/BackButton';
import { btnGhost, card, cardBody, dashboardPageWide } from '../lib/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_YEAR_BUCKETS = Object.freeze(
  Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, []])),
);

/** Split already-loaded trades into month buckets for a calendar year (no network). */
function bucketTradesByMonth(trades, year) {
  const map = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, []]));
  const prefix = `${year}-`;
  for (const t of trades) {
    if (!t?.date || !t.date.startsWith(prefix)) continue;
    const month = Number(t.date.slice(5, 7));
    if (month >= 1 && month <= 12) map[month].push(t);
  }
  return map;
}

function isWeekendDow(dow) {
  return dow === 0 || dow === 6;
}

/** Monday-first index: Mon=0 … Sun=6 */
function mondayFirstIndex(dow) {
  return dow === 0 ? 6 : dow - 1;
}

function isWeekendDateString(ds) {
  if (!ds) return false;
  const [y, m, d] = ds.split('-').map(Number);
  return isWeekendDow(new Date(y, m - 1, d).getDay());
}

function cellClass(tone, today, tall = false, weekend = false) {
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

function miniCellClass(tone, today) {
  const base = 'flex h-5 w-5 items-center justify-center rounded text-[9px] font-medium';
  if (tone === 'win') return `${base} bg-violet-500 text-white`;
  if (tone === 'loss') return `${base} bg-rose-500 text-white`;
  if (tone === 'be') return `${base} bg-amber-400 text-white`;
  if (today) return `${base} ring-1 ring-violet-400 text-zinc-600 dark:text-zinc-300`;
  return `${base} text-zinc-500 dark:text-zinc-400`;
}

function dateString(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function summarizeWeek(days, tradeMap, overrideMap, useOverrides) {
  let weekPnl = 0;
  let weekTrades = 0;
  days.forEach((ds) => {
    if (!ds) return;
    const dts = tradeMap[ds] || [];
    const override = useOverrides ? overrideMap[ds] : null;
    weekTrades += resolveDayTradeCount(dts, override);
    weekPnl += resolveDayPnl(dts, override);
  });
  return { weekPnl, weekTrades, weekActive: days.some((ds) => ds && dayHasActivity(tradeMap[ds] || [], useOverrides ? overrideMap[ds] : null)) };
}

function buildMonthWeeks(year, month, tradeMap, overrideMap, useOverrides) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeek = [null, null, null, null, null, null, null];

  function flushWeek() {
    if (!currentWeek.some(Boolean)) return;
    const { weekPnl, weekTrades, weekActive } = summarizeWeek(currentWeek, tradeMap, overrideMap, useOverrides);
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

function weekRangeLabel(days) {
  const inWeek = days.filter(Boolean);
  if (inWeek.length === 0) return 'Week';
  const start = parseInt(inWeek[0].split('-')[2], 10);
  const end = parseInt(inWeek[inWeek.length - 1].split('-')[2], 10);
  return start === end ? `Day ${start}` : `${start}–${end}`;
}

function monthTotalPnl(trades, overrideMap, useOverrides) {
  const tradeMap = {};
  trades.forEach((t) => { (tradeMap[t.date] ||= []).push(t); });
  const dates = new Set([...Object.keys(tradeMap), ...(useOverrides ? Object.keys(overrideMap) : [])]);
  let total = 0;
  dates.forEach((ds) => {
    total += resolveDayPnl(tradeMap[ds] || [], useOverrides ? overrideMap[ds] : null);
  });
  return total;
}

function StatCard({ value, label, valueClass = 'text-zinc-900' }) {
  return (
    <div className={`${card} p-4 text-center`}>
      <div className={`text-xl font-bold tracking-tight ${valueClass}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Profit</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Loss</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />BE</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-zinc-300 bg-white" />No trade</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />Weekend</span>
      <span className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-violet-600">M</span>Manual PnL</span>
    </div>
  );
}

function MonthPickerCard({ year, month, trades, overrideMap, useOverrides, denomination = 'usd', onSelect }) {
  const tradeMap = {};
  trades.forEach((t) => { (tradeMap[t.date] ||= []).push(t); });
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];
  const totalPnl = monthTotalPnl(trades, overrideMap, useOverrides);
  const totalTrades = monthTradeTotal(trades, overrideMap, useOverrides, year, month);
  const hasActivity = totalTrades > 0 || (useOverrides && Object.keys(overrideMap).some((d) => d.startsWith(`${year}-${String(month).padStart(2, '0')}`)));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div className="h-5 w-5" key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dts = tradeMap[ds] || [];
    const override = useOverrides ? overrideMap[ds] : null;
    const dayPnl = resolveDayPnl(dts, override);
    const tone = toneFromPnl(dayPnl, dayHasActivity(dts, override));
    const weekend = isWeekendDow(new Date(year, month - 1, d).getDay());
    cells.push(
      <div
        className={`${miniCellClass(tone, ds === today)} ${weekend && tone === 'none' ? 'text-zinc-300 dark:text-zinc-600' : ''} ${weekend ? 'opacity-70' : ''}`}
        key={ds}
        title={dayHasActivity(dts, override) ? fmtPnlStrict(dayPnl, denomination) : weekend ? 'Weekend' : ''}
      >
        {d}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
      onClick={() => onSelect(month)}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-900">{MONTHS_SHORT[month - 1]}</div>
        {hasActivity && (
          <div className="text-right text-[10px] leading-tight">
            <div className={totalPnl >= 0 ? 'font-semibold text-violet-600' : 'font-semibold text-rose-600'}>{fmtPnlStrict(totalPnl, denomination)}</div>
            <div className="text-zinc-400">{totalTrades} trade{totalTrades !== 1 ? 's' : ''}</div>
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

function YearView({ year, yearTrades, overrideMap, useOverrides, denomination = 'usd', loading, onYearChange, onSelectMonth }) {
  const allTrades = useMemo(() => Object.values(yearTrades).flat(), [yearTrades]);
  const totalPnl = monthTotalPnl(allTrades, overrideMap, useOverrides);
  const totalTrades = yearTradeTotal(allTrades, overrideMap, useOverrides, year);
  const wins = allTrades.filter((t) => t.result === 'win').length;
  const wr = allTrades.length > 0 ? Math.round((wins / allTrades.length) * 100) : 0;
  const currentYear = new Date().getFullYear();
  const hasActivity = totalTrades > 0 || (useOverrides && Object.keys(overrideMap).some((d) => d.startsWith(`${year}-`)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <YearDropdown value={year} onChange={onYearChange} />
          {year !== currentYear && (
            <button className={btnGhost} type="button" onClick={() => onYearChange(currentYear)}>
              Go to {currentYear}
            </button>
          )}
          <p className="w-full text-sm text-zinc-500">Select a month to view and edit daily PnL</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          value={hasActivity ? fmtPnlStrict(totalPnl, denomination) : '—'}
          label="Yearly PnL"
          valueClass={totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
        <StatCard value={hasActivity ? totalTrades : '—'} label="Trades" />
        <StatCard value={allTrades.length > 0 ? `${wr}%` : '—'} label="Win Rate" />
      </div>

      {loading ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MONTHS.map((_, i) => (
            <MonthPickerCard
              key={i}
              year={year}
              month={i + 1}
              trades={yearTrades[i + 1] || []}
              overrideMap={overrideMap}
              useOverrides={useOverrides}
              denomination={denomination}
              onSelect={onSelectMonth}
            />
          ))}
        </div>
      )}

      <Legend />
    </div>
  );
}

function MonthDetailView({
  year,
  month,
  monthTrades,
  overrideMap,
  useOverrides,
  denomination = 'usd',
  loading,
  onBack,
  onPrevMonth,
  onNextMonth,
  onEditDay,
}) {
  const totalPnl = monthTotalPnl(monthTrades, overrideMap, useOverrides);
  const totalTrades = monthTradeTotal(monthTrades, overrideMap, useOverrides, year, month);
  const wins = monthTrades.filter((t) => t.result === 'win').length;
  const wr = monthTrades.length > 0 ? Math.round((wins / monthTrades.length) * 100) : 0;
  const today = new Date().toISOString().split('T')[0];
  const hasActivity = totalTrades > 0 || (useOverrides && Object.keys(overrideMap).some((d) => d.startsWith(`${year}-${String(month).padStart(2, '0')}`)));

  const { weeks, tradeMap } = useMemo(() => {
    const map = {};
    monthTrades.forEach((t) => { (map[t.date] ||= []).push(t); });
    return {
      weeks: buildMonthWeeks(year, month, map, overrideMap, useOverrides),
      tradeMap: map,
    };
  }, [year, month, monthTrades, overrideMap, useOverrides]);

  const bestWeekPnl = weeks.reduce((best, w) => (w.weekActive && w.weekPnl > best ? w.weekPnl : best), -Infinity);
  const bestWeek = bestWeekPnl === -Infinity ? null : weeks.find((w) => w.weekPnl === bestWeekPnl);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-2">
          <button className={btnGhost} type="button" onClick={onPrevMonth}>Prev</button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold text-zinc-900">
            {MONTHS[month - 1]} {year}
          </h2>
          <button className={btnGhost} type="button" onClick={onNextMonth}>Next</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          value={hasActivity ? fmtPnlStrict(totalPnl, denomination) : '—'}
          label="Monthly PnL"
          valueClass={totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
        <StatCard value={hasActivity ? totalTrades : '—'} label="Trades" />
        <StatCard value={monthTrades.length > 0 ? `${wr}%` : '—'} label="Win Rate" />
        <StatCard
          value={bestWeek ? fmtPnlStrict(bestWeek.weekPnl, denomination) : '—'}
          label={bestWeek ? `Best week (${weekRangeLabel(bestWeek.days)})` : 'Best week'}
          valueClass={bestWeek && bestWeek.weekPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
      </div>

      {useOverrides && (
        <p className="text-xs text-zinc-500">Click any day to set or edit manual PnL.</p>
      )}

      {loading ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>Loading...</div>
      ) : (
        <div className={card}>
          <div className={cardBody}>
            <div className="mb-2 grid grid-cols-8 gap-2">
              {WEEK_DAYS.map((d) => (
                <div
                  className={`py-1 text-center text-xs font-semibold ${
                    d === 'Sat' || d === 'Sun' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'
                  }`}
                  key={d}
                >
                  {d}
                </div>
              ))}
              <div className="py-1 text-center text-xs font-semibold text-violet-600">Week PnL</div>
            </div>

            <div className="space-y-2">
              {weeks.map((week) => (
                <div className="grid grid-cols-8 gap-2" key={week.index}>
                  {week.days.map((ds, idx) => {
                    if (!ds) return <div key={`empty-${week.index}-${idx}`} className="rounded-xl bg-zinc-100/80 dark:bg-zinc-900/50" />;
                    const dts = tradeMap[ds] || [];
                    const override = useOverrides ? overrideMap[ds] : null;
                    const dayPnl = resolveDayPnl(dts, override);
                    const count = resolveDayTradeCount(dts, override);
                    const active = dayHasActivity(dts, override);
                    const tone = toneFromPnl(dayPnl, active);
                    const dayNum = parseInt(ds.split('-')[2], 10);
                    const manual = Boolean(override);
                    const weekend = isWeekendDateString(ds);

                    const inner = (
                      <>
                        <span className="flex w-full items-start justify-between gap-1">
                          <span className={`text-xs font-medium ${weekend ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {dayNum}
                          </span>
                          {manual && <span className="text-[9px] font-bold text-violet-600">M</span>}
                        </span>
                        {active && (
                          <span className={`mt-auto text-xs font-bold ${dayPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                            {fmtPnlStrict(dayPnl, denomination)}
                          </span>
                        )}
                        {active && (
                          <span className="text-[10px] text-zinc-400">{count} trade{count !== 1 ? 's' : ''}</span>
                        )}
                        {!active && useOverrides && (
                          <span className="mt-auto text-[9px] text-zinc-400">Tap to add</span>
                        )}
                      </>
                    );

                    if (useOverrides) {
                      return (
                        <button
                          type="button"
                          className={`${cellClass(tone, ds === today, false, weekend)} cursor-pointer text-left`}
                          key={ds}
                          onClick={() => onEditDay(ds, dts, override)}
                        >
                          {inner}
                        </button>
                      );
                    }

                    return (
                      <div className={cellClass(tone, ds === today, false, weekend)} key={ds}>
                        {inner}
                      </div>
                    );
                  })}
                  <div className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border p-2 text-center ${
                    !week.weekActive
                      ? 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60'
                      : week.weekPnl >= 0
                        ? 'border-violet-200 bg-violet-50'
                        : 'border-rose-200 bg-rose-50'
                  }`}>
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{weekRangeLabel(week.days)}</span>
                    <span className={`mt-1 text-sm font-bold ${!week.weekActive ? 'text-zinc-400' : week.weekPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                      {week.weekActive ? fmtPnlStrict(week.weekPnl, denomination) : '—'}
                    </span>
                    {week.weekTrades > 0 && (
                      <span className="mt-0.5 text-[9px] text-zinc-400">{week.weekTrades} trade{week.weekTrades !== 1 ? 's' : ''}</span>
                    )}
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

export default function CalendarPage() {
  const {
    visibleTrades,
    viewMode,
    activeAccount,
    dataLoading,
    refreshTrades,
  } = useAppData();
  const useOverrides = viewMode === 'portfolio';
  const denomination = viewPnlDenomination(viewMode, activeAccount);
  const now = new Date();
  const [screen, setScreen] = useState('year');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyOverrides, setDailyOverrides] = useState({});
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [editDay, setEditDay] = useState(null);

  // Trades are already loaded by AppDataContext — bucket locally instead of 12 monthly API calls.
  const yearTrades = useMemo(
    () => (dataLoading ? EMPTY_YEAR_BUCKETS : bucketTradesByMonth(visibleTrades, year)),
    [visibleTrades, year, dataLoading],
  );
  const monthTrades = yearTrades[month] || [];

  useEffect(() => {
    if (!useOverrides) {
      setDailyOverrides({});
      setLoadingOverrides(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingOverrides(true);
    (async () => {
      try {
        const rows = await fetchDailyPnlByYear(year);
        if (!cancelled) setDailyOverrides(overridesToMap(rows));
      } catch {
        if (!cancelled) setDailyOverrides({});
      } finally {
        if (!cancelled) setLoadingOverrides(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, useOverrides]);

  const loadingYear = dataLoading || (useOverrides && loadingOverrides);
  const loadingMonth = dataLoading || (useOverrides && loadingOverrides);

  async function handleDailySaved() {
    if (useOverrides) {
      try {
        const rows = await fetchDailyPnlByYear(year);
        setDailyOverrides(overridesToMap(rows));
      } catch {
        setDailyOverrides({});
      }
    }
    await refreshTrades();
  }

  function openMonth(m) {
    setMonth(m);
    setScreen('detail');
  }

  function goBackToYear() {
    setScreen('year');
  }

  function prevMonth() {
    setMonth((m) => {
      if (m === 1) { setYear((y) => y - 1); return 12; }
      return m - 1;
    });
  }

  function nextMonth() {
    setMonth((m) => {
      if (m === 12) { setYear((y) => y + 1); return 1; }
      return m + 1;
    });
  }

  return (
    <div className={dashboardPageWide}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900">Calendar</h1>
          <p className="text-sm text-zinc-500">Filter by account or view all accounts.</p>
        </div>
        <AccountViewDropdown />
      </div>
      {screen === 'year' ? (
        <YearView
          year={year}
          yearTrades={yearTrades}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
          denomination={denomination}
          loading={loadingYear}
          onYearChange={setYear}
          onSelectMonth={openMonth}
        />
      ) : (
        <MonthDetailView
          year={year}
          month={month}
          monthTrades={monthTrades}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
          denomination={denomination}
          loading={loadingMonth}
          onBack={goBackToYear}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          onEditDay={(date, dts, override) => setEditDay({
            date,
            tradesSum: tradesSumForDay(dts),
            tradeCount: dts.length,
            override,
          })}
        />
      )}

      {editDay && (
        <DailyPnlModal
          date={editDay.date}
          tradesSum={editDay.tradesSum}
          tradeCount={editDay.tradeCount}
          override={editDay.override}
          denomination={denomination}
          onClose={() => setEditDay(null)}
          onSaved={handleDailySaved}
        />
      )}
    </div>
  );
}
