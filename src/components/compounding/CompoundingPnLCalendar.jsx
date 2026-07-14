import { useMemo, useState } from 'react';
import { computeTradePreview } from '../../lib/compounding/calculations';
import {
  formatCalendarDaySummary,
  formatLocalDate,
  getCalendarWeekRows,
  getMonthSummaryFromTrades,
} from '../../lib/compounding/calendarPnL';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { btnGhost, card, cardBody } from '../../lib/ui';
import { pnlToneClass } from './CompoundingUI';

export default function CompoundingPnLCalendar({
  trades,
  config,
  currentBalance,
  selectedDate,
  onSelectDate,
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekRows = useMemo(() => getCalendarWeekRows(year, month), [year, month]);
  const today = formatLocalDate(new Date());
  const dailyData = useMemo(() => getMonthSummaryFromTrades(trades, year, month), [trades, year, month]);
  const selectedEntry = dailyData[selectedDate];
  const preview = computeTradePreview(currentBalance, config);

  const changeMonth = (delta) => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  return (
    <div className={`${card} ${cardBody} mx-auto w-full max-w-5xl space-y-5`}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={btnGhost} onClick={() => changeMonth(-1)} aria-label="Previous month">
          Prev
        </button>
        <h3 className="text-base font-semibold text-zinc-900">{monthName}</h3>
        <button type="button" className={btnGhost} onClick={() => changeMonth(1)} aria-label="Next month">
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={`${day}-${i}`} className="py-1 text-center text-xs font-semibold text-zinc-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekRows.flat().map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
          const dateStr = formatLocalDate(new Date(year, month, day));
          const dayData = dailyData[dateStr];
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`h-14 rounded-xl border text-center text-xs transition sm:h-16 ${
                isSelected
                  ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-200'
                  : 'border-zinc-200 bg-white hover:border-violet-200 hover:bg-zinc-50'
              } ${isToday && !isSelected ? 'border-violet-200' : ''}`}
            >
              <div className="font-semibold text-zinc-800">{day}</div>
              {dayData ? (
                <div className={`mt-0.5 tabular-nums ${pnlToneClass(dayData.amount)}`}>
                  {formatMoney(dayData.amount, { compact: true })}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <div className="font-medium text-zinc-900">Selected: {selectedDate}</div>
        {selectedEntry ? (
          <p className="mt-1">
            {formatCalendarDaySummary(selectedEntry)} ·{' '}
            <span className={pnlToneClass(selectedEntry.amount)}>{formatMoney(selectedEntry.amount)}</span>
          </p>
        ) : (
          <p className="mt-1 text-zinc-400">No compounding trades this day yet.</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Next step from plan: win {formatMoney(preview.targetProfit)} / risk {formatMoney(-preview.riskAmount)}
        </p>
      </div>
    </div>
  );
}
