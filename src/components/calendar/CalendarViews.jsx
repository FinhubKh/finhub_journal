import { useMemo } from 'react';
import { fmtPnlStrict } from '../../lib/format';
import { toneFromPnl } from '../../lib/dailyPnl';
import YearDropdown from '../common/YearDropdown';
import BackButton from '../common/BackButton';
import { btnGhost, card, cardBody } from '../../lib/ui';
import {
  MONTHS,
  MONTHS_SHORT,
  DAYS,
  WEEK_DAYS,
  rowsToMap,
  rowPnl,
  rowTrades,
  rowActive,
  periodTotals,
  isWeekendDow,
  isWeekendDateString,
  cellClass,
  miniCellClass,
  buildMonthWeeks,
  weekRangeLabel,
  monthPrefix,
} from '../../lib/calendarCells';

export function CalendarStatCard({ value, label, valueClass = 'text-zinc-900' }) {
  return (
    <div className={`${card} p-4 text-center`}>
      <div className={`text-xl font-bold tracking-tight ${valueClass}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}

export function CalendarLegend({ showManual = true }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Profit</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Loss</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />BE</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-zinc-300 bg-white" />No trade</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />Weekend</span>
      {showManual && (
        <span className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-violet-600">M</span>Manual PnL</span>
      )}
    </div>
  );
}

function MonthPickerCard({ year, month, days, overrideMap, useOverrides, denomination = 'usd', onSelect, fill = false }) {
  const dayMap = rowsToMap(days);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split('T')[0];
  const totals = periodTotals(days, overrideMap, useOverrides, monthPrefix(year, month));
  const totalPnl = totals.pnl;
  const totalTrades = totals.trades;
  const hasActivity = totalTrades > 0 || (useOverrides && Object.keys(overrideMap).some((d) => d.startsWith(monthPrefix(year, month))));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div className="h-5 w-5" key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const row = dayMap[ds];
    const override = useOverrides ? overrideMap[ds] : null;
    const dayPnl = rowPnl(row, override);
    const active = rowActive(row, override);
    const tone = toneFromPnl(dayPnl, active);
    const weekend = isWeekendDow(new Date(year, month - 1, d).getDay());
    cells.push(
      <div
        className={`${miniCellClass(tone, ds === today)} ${weekend && tone === 'none' ? 'text-zinc-300 dark:text-zinc-600' : ''} ${weekend ? 'opacity-70' : ''}`}
        key={ds}
        title={active ? fmtPnlStrict(dayPnl, denomination) : weekend ? 'Weekend' : ''}
      >
        {d}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-600 dark:hover:bg-violet-950/40 ${
        fill ? 'flex h-full min-h-0 flex-col' : ''
      }`}
      onClick={() => onSelect(month)}
    >
      <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{MONTHS_SHORT[month - 1]}</div>
        {hasActivity && (
          <div className="text-right text-[10px] leading-tight">
            <div className={totalPnl >= 0 ? 'font-semibold text-violet-600' : 'font-semibold text-rose-600'}>{fmtPnlStrict(totalPnl, denomination)}</div>
            <div className="text-zinc-400">{totalTrades} trade{totalTrades !== 1 ? 's' : ''}</div>
          </div>
        )}
      </div>
      <div className={`grid grid-cols-7 gap-0.5 ${fill ? 'min-h-0 flex-1 content-start' : ''}`}>
        {DAYS.map((d) => <div className="flex h-5 w-5 items-center justify-center text-[8px] font-medium text-zinc-400" key={d}>{d[0]}</div>)}
        {cells}
      </div>
    </button>
  );
}

export function YearView({
  year,
  yearDays,
  overrideMap,
  useOverrides,
  denomination = 'usd',
  loading,
  onYearChange,
  onSelectMonth,
  hint = 'Select a month to view and edit daily PnL',
  showManualLegend = true,
  minYear,
  maxYear,
  fill = false,
  hideHeader = false,
}) {
  const currentYear = new Date().getFullYear();

  return (
    <div className={fill ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4'}>
      {!hideHeader && (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <YearDropdown value={year} onChange={onYearChange} minYear={minYear} maxYear={maxYear} />
            {year !== currentYear && (
              <button className={btnGhost} type="button" onClick={() => onYearChange(currentYear)}>
                Go to {currentYear}
              </button>
            )}
          </div>
          {hint ? <p className="hidden text-xs text-zinc-400 lg:block">{hint}</p> : null}
        </div>
      )}

      {loading ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>Loading...</div>
      ) : (
        <div className={fill
          ? 'grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 xl:grid-cols-4'
          : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}
        >
          {MONTHS.map((_, i) => (
            <MonthPickerCard
              key={i}
              year={year}
              month={i + 1}
              days={yearDays[i + 1] || []}
              overrideMap={overrideMap}
              useOverrides={useOverrides}
              denomination={denomination}
              onSelect={onSelectMonth}
              fill={fill}
            />
          ))}
        </div>
      )}

      <div className="shrink-0">
        <CalendarLegend showManual={showManualLegend} />
      </div>
    </div>
  );
}

export function MonthDetailView({
  year,
  month,
  monthDays,
  overrideMap,
  useOverrides,
  denomination = 'usd',
  loading,
  onBack,
  onPrevMonth,
  onNextMonth,
  onEditDay,
  onSelectDay,
  showManualLegend = true,
  fill = false,
}) {
  const totals = periodTotals(monthDays, overrideMap, useOverrides, monthPrefix(year, month));
  const totalPnl = totals.pnl;
  const totalTrades = totals.trades;
  const wr = totals.actualTrades > 0 ? Math.round((totals.wins / totals.actualTrades) * 100) : 0;
  const today = new Date().toISOString().split('T')[0];
  const hasActivity = totalTrades > 0 || (useOverrides && Object.keys(overrideMap).some((d) => d.startsWith(monthPrefix(year, month))));

  const { weeks, dayMap } = useMemo(() => {
    const map = rowsToMap(monthDays);
    return {
      weeks: buildMonthWeeks(year, month, map, overrideMap, useOverrides),
      dayMap: map,
    };
  }, [year, month, monthDays, overrideMap, useOverrides]);

  const bestWeekPnl = weeks.reduce((best, w) => (w.weekActive && w.weekPnl > best ? w.weekPnl : best), -Infinity);
  const bestWeek = bestWeekPnl === -Infinity ? null : weeks.find((w) => w.weekPnl === bestWeekPnl);

  return (
    <div className={fill ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4'}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-2">
          <button className={btnGhost} type="button" onClick={onPrevMonth}>Prev</button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {MONTHS[month - 1]} {year}
          </h2>
          <button className={btnGhost} type="button" onClick={onNextMonth}>Next</button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <CalendarStatCard
          value={hasActivity ? fmtPnlStrict(totalPnl, denomination) : '—'}
          label="Monthly PnL"
          valueClass={totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
        <CalendarStatCard value={hasActivity ? totalTrades : '—'} label="Trades" />
        <CalendarStatCard value={totals.actualTrades > 0 ? `${wr}%` : '—'} label="Win Rate" />
        <CalendarStatCard
          value={bestWeek ? fmtPnlStrict(bestWeek.weekPnl, denomination) : '—'}
          label={bestWeek ? `Best week (${weekRangeLabel(bestWeek.days)})` : 'Best week'}
          valueClass={bestWeek && bestWeek.weekPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
        />
      </div>

      {useOverrides && (
        <p className="text-xs text-zinc-500">Click any day to set or edit manual PnL.</p>
      )}
      {!useOverrides && onSelectDay && (
        <p className="text-xs text-zinc-500">Click a day to view its trading log.</p>
      )}

      {loading ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>Loading...</div>
      ) : (
        <div className={`${card} overflow-hidden ${fill ? 'min-h-0 flex-1 overflow-auto' : ''}`}>
          <div className={`${cardBody} overflow-x-auto pb-3`}>
            <div className="min-w-[620px]">
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
                      const row = dayMap[ds];
                      const override = useOverrides ? overrideMap[ds] : null;
                      const dayPnl = rowPnl(row, override);
                      const count = rowTrades(row, override);
                      const active = rowActive(row, override);
                      const tone = toneFromPnl(dayPnl, active);
                      const dayNum = parseInt(ds.split('-')[2], 10);
                      const manual = Boolean(override);
                      const weekend = isWeekendDateString(ds);
                      const canOpenLog = Boolean(onSelectDay) && active;

                      const inner = (
                        <>
                          <span className="flex w-full items-start justify-between gap-1">
                            <span className={`text-xs font-medium ${weekend ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                              {dayNum}
                            </span>
                            {manual && <span className="text-[9px] font-bold text-violet-600">M</span>}
                          </span>
                          {active && (
                            <span className={`mt-auto text-xs font-bold whitespace-nowrap truncate ${dayPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                              {fmtPnlStrict(dayPnl, denomination)}
                            </span>
                          )}
                          {active && (
                            <span className="text-[10px] text-zinc-400 whitespace-nowrap truncate">{count} trade{count !== 1 ? 's' : ''}</span>
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
                            onClick={() => onEditDay(ds, row, override)}
                          >
                            {inner}
                          </button>
                        );
                      }

                      if (canOpenLog) {
                        return (
                          <button
                            type="button"
                            className={`${cellClass(tone, ds === today, false, weekend)} cursor-pointer text-left transition hover:ring-2 hover:ring-violet-300/70 dark:hover:ring-violet-700/60`}
                            key={ds}
                            onClick={() => onSelectDay(ds, row)}
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
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap truncate">{weekRangeLabel(week.days)}</span>
                      <span className={`mt-1 text-sm font-bold whitespace-nowrap truncate ${!week.weekActive ? 'text-zinc-400' : week.weekPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                        {week.weekActive ? fmtPnlStrict(week.weekPnl, denomination) : '—'}
                      </span>
                      {week.weekTrades > 0 && (
                        <span className="mt-0.5 text-[9px] text-zinc-400 whitespace-nowrap truncate">{week.weekTrades} trade{week.weekTrades !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0">
        <CalendarLegend showManual={showManualLegend} />
      </div>
    </div>
  );
}
