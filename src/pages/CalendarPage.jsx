import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { fetchTradesByMonth, fetchDailyPnlByYear } from '../api';
import { filterTradesForView } from '../lib/accounts';
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
import DailyPnlModal from '../components/DailyPnlModal';
import YearDropdown from '../components/YearDropdown';
import { btnGhost, card, cardBody, dashboardPageWide, dashboardPageWideFull } from '../lib/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TRADING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function cellClass(tone, today, tall = false) {
  const base = `relative flex flex-col rounded-xl border p-2 text-xs transition ${tall ? 'min-h-[88px] h-full' : 'min-h-[72px]'}`;
  if (tone === 'win') return `${base} border-violet-200 bg-violet-50 ${today ? 'ring-2 ring-violet-400' : ''}`;
  if (tone === 'loss') return `${base} border-rose-200 bg-rose-50 ${today ? 'ring-2 ring-rose-400' : ''}`;
  if (tone === 'be') return `${base} border-amber-200 bg-amber-50 ${today ? 'ring-2 ring-amber-400' : ''}`;
  return `${base} border-zinc-100 bg-white hover:border-violet-200 hover:bg-violet-50/50 ${today ? 'ring-2 ring-violet-300' : ''}`;
}

function miniCellClass(tone, today) {
  const base = 'flex h-5 w-5 items-center justify-center rounded text-[9px] font-medium';
  if (tone === 'win') return `${base} bg-violet-500 text-white`;
  if (tone === 'loss') return `${base} bg-rose-500 text-white`;
  if (tone === 'be') return `${base} bg-amber-400 text-white`;
  if (today) return `${base} ring-1 ring-violet-400 text-zinc-600`;
  return `${base} text-zinc-500`;
}

function fmtPnl(v) {
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
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
  let currentWeek = [null, null, null, null, null];

  function flushWeek() {
    if (!currentWeek.some(Boolean)) return;
    const { weekPnl, weekTrades, weekActive } = summarizeWeek(currentWeek, tradeMap, overrideMap, useOverrides);
    weeks.push({ days: [...currentWeek], weekPnl, weekTrades, weekActive, index: weeks.length + 1 });
    currentWeek = [null, null, null, null, null];
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;

    const weekdayIndex = dow - 1;
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
      <span className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-violet-600">M</span>Manual PnL</span>
    </div>
  );
}

function MonthPickerCard({ year, month, trades, overrideMap, useOverrides, onSelect }) {
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
    cells.push(
      <div className={miniCellClass(tone, ds === today)} key={ds} title={dayHasActivity(dts, override) ? fmtPnl(dayPnl) : ''}>
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
            <div className={totalPnl >= 0 ? 'font-semibold text-violet-600' : 'font-semibold text-rose-600'}>{fmtPnl(totalPnl)}</div>
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

function YearView({ year, yearTrades, overrideMap, useOverrides, loading, onYearChange, onSelectMonth }) {
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
          value={hasActivity ? fmtPnl(totalPnl) : '—'}
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <button className={btnGhost} type="button" onClick={onBack}>Back to {year}</button>
        <div className="flex items-center gap-2">
          <button className={btnGhost} type="button" onClick={onPrevMonth}>Prev</button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold text-zinc-900">
            {MONTHS[month - 1]} {year}
          </h2>
          <button className={btnGhost} type="button" onClick={onNextMonth}>Next</button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          value={hasActivity ? fmtPnl(totalPnl) : '—'}
          label="Monthly PnL"
          valueClass={totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
        <StatCard value={hasActivity ? totalTrades : '—'} label="Trades" />
        <StatCard value={monthTrades.length > 0 ? `${wr}%` : '—'} label="Win Rate" />
        <StatCard
          value={bestWeek ? fmtPnl(bestWeek.weekPnl) : '—'}
          label={bestWeek ? `Best week (${weekRangeLabel(bestWeek.days)})` : 'Best week'}
          valueClass={bestWeek && bestWeek.weekPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
      </div>

      {useOverrides && (
        <p className="shrink-0 text-xs text-zinc-500">Click any day to set or edit manual PnL.</p>
      )}

      {loading ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>Loading...</div>
      ) : (
        <div className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className={`${cardBody} flex min-h-0 flex-1 flex-col`}>
            <div className="mb-2 grid grid-cols-6 gap-2">
              {TRADING_DAYS.map((d) => (
                <div className="py-1 text-center text-xs font-semibold text-zinc-400" key={d}>{d}</div>
              ))}
              <div className="py-1 text-center text-xs font-semibold text-violet-600">Week PnL</div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {weeks.map((week) => (
                <div className="grid min-h-[92px] flex-1 grid-cols-6 gap-2" key={week.index}>
                  {week.days.map((ds, idx) => {
                    if (!ds) return <div key={`empty-${week.index}-${idx}`} className="rounded-xl bg-zinc-50/80" />;
                    const dts = tradeMap[ds] || [];
                    const override = useOverrides ? overrideMap[ds] : null;
                    const dayPnl = resolveDayPnl(dts, override);
                    const count = resolveDayTradeCount(dts, override);
                    const active = dayHasActivity(dts, override);
                    const tone = toneFromPnl(dayPnl, active);
                    const dayNum = parseInt(ds.split('-')[2], 10);
                    const manual = Boolean(override);

                    const inner = (
                      <>
                        <span className="flex w-full items-start justify-between gap-1">
                          <span className="text-xs font-medium text-zinc-700">{dayNum}</span>
                          {manual && <span className="text-[9px] font-bold text-violet-600">M</span>}
                        </span>
                        {active && (
                          <span className={`mt-auto text-xs font-bold ${dayPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                            {fmtPnl(dayPnl)}
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
                          className={`${cellClass(tone, ds === today, true)} cursor-pointer text-left`}
                          key={ds}
                          onClick={() => onEditDay(ds, dts, override)}
                        >
                          {inner}
                        </button>
                      );
                    }

                    return (
                      <div className={cellClass(tone, ds === today, true)} key={ds}>
                        {inner}
                      </div>
                    );
                  })}
                  <div className={`flex h-full flex-col items-center justify-center rounded-xl border p-2 text-center ${
                    !week.weekActive
                      ? 'border-zinc-100 bg-zinc-50'
                      : week.weekPnl >= 0
                        ? 'border-violet-200 bg-violet-50'
                        : 'border-rose-200 bg-rose-50'
                  }`}>
                    <span className="text-[10px] font-medium text-zinc-500">{weekRangeLabel(week.days)}</span>
                    <span className={`mt-1 text-sm font-bold ${!week.weekActive ? 'text-zinc-400' : week.weekPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                      {week.weekActive ? fmtPnl(week.weekPnl) : '—'}
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

      <div className="shrink-0">
        <Legend />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { tradingAccounts, viewMode, activeAccountId, refreshTrades } = useAppData();
  const useOverrides = viewMode === 'portfolio';
  const now = new Date();
  const [screen, setScreen] = useState('year');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthTrades, setMonthTrades] = useState([]);
  const [yearTrades, setYearTrades] = useState({});
  const [dailyOverrides, setDailyOverrides] = useState({});
  const [loadingYear, setLoadingYear] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [editDay, setEditDay] = useState(null);

  const loadDailyOverrides = useCallback(async (y) => {
    try {
      const rows = await fetchDailyPnlByYear(y);
      setDailyOverrides(overridesToMap(rows));
    } catch {
      setDailyOverrides({});
    }
  }, []);

  const loadYear = useCallback(async () => {
    setLoadingYear(true);
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) => fetchTradesByMonth(year, i + 1)),
      );
      const map = {};
      results.forEach((data, i) => {
        map[i + 1] = filterTradesForView(data, tradingAccounts, viewMode, activeAccountId);
      });
      setYearTrades(map);
      await loadDailyOverrides(year);
    } catch {
      setYearTrades({});
    } finally {
      setLoadingYear(false);
    }
  }, [year, tradingAccounts, viewMode, activeAccountId, loadDailyOverrides]);

  const loadMonth = useCallback(async (y, m) => {
    setLoadingMonth(true);
    try {
      const data = await fetchTradesByMonth(y, m);
      setMonthTrades(filterTradesForView(data, tradingAccounts, viewMode, activeAccountId));
      await loadDailyOverrides(y);
    } catch {
      setMonthTrades([]);
    } finally {
      setLoadingMonth(false);
    }
  }, [tradingAccounts, viewMode, activeAccountId, loadDailyOverrides]);

  useEffect(() => { loadYear(); }, [loadYear]);

  useEffect(() => {
    if (screen === 'detail') loadMonth(year, month);
  }, [screen, year, month, loadMonth]);

  async function handleDailySaved() {
    await loadDailyOverrides(year);
    await loadYear();
    if (screen === 'detail') await loadMonth(year, month);
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
    <div className={screen === 'detail' ? dashboardPageWideFull : dashboardPageWide}>
      {screen === 'year' ? (
        <YearView
          year={year}
          yearTrades={yearTrades}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
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
          onClose={() => setEditDay(null)}
          onSaved={handleDailySaved}
        />
      )}
    </div>
  );
}
