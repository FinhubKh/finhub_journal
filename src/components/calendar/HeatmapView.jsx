import { useMemo } from 'react';
import { fmtPnlStrict } from '../../lib/format';
import { MONTHS_SHORT, bucketDailyByMonth, periodTotals, yearsFromDates } from '../../lib/calendarCells';
import { card, cardBody, cardHd, cardTitle, emptyState } from '../../lib/ui';

function monthTone(pnl, hasActivity) {
  if (!hasActivity) {
    return {
      bg: 'bg-transparent',
      text: 'text-zinc-300 dark:text-zinc-700',
      border: 'border border-dashed border-zinc-200/80 dark:border-zinc-800',
    };
  }
  if (pnl > 0) {
    return {
      bg: 'bg-emerald-500/15 dark:bg-emerald-950/50',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border border-emerald-500/20 dark:border-emerald-500/15',
    };
  }
  if (pnl < 0) {
    return {
      bg: 'bg-rose-500/15 dark:bg-rose-950/50',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border border-rose-500/20 dark:border-rose-500/15',
    };
  }
  return {
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-200',
    border: 'border border-zinc-200 dark:border-zinc-700',
  };
}

function compactPnl(pnl, denomination) {
  const abs = Math.abs(pnl);
  if (abs >= 1000) {
    const signed = pnl >= 0 ? '+' : '−';
    return `${signed}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  }
  return fmtPnlStrict(pnl, denomination);
}

export default function HeatmapView({ daily, denomination = 'usd', fill = false }) {
  const years = useMemo(() => {
    const y = yearsFromDates(daily);
    return [...y].sort((a, b) => b - a);
  }, [daily]);

  const yearData = useMemo(() => years.map((year) => {
    const yearDaysMap = bucketDailyByMonth(daily, year);
    let yearTotalPnl = 0;
    let yearTotalTrades = 0;
    let yearWins = 0;

    const months = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1;
      const monthDays = yearDaysMap[monthIndex] || [];
      const prefix = `${year}-${String(monthIndex).padStart(2, '0')}`;
      const totals = periodTotals(monthDays, {}, false, prefix);

      yearTotalPnl += totals.pnl;
      yearTotalTrades += totals.trades;
      yearWins += totals.wins;

      return {
        month: monthIndex,
        pnl: totals.pnl,
        trades: totals.trades,
        hasActivity: totals.trades > 0 || totals.pnl !== 0,
      };
    });

    return {
      year,
      months,
      yearTotalPnl,
      yearTotalTrades,
      yearWr: yearTotalTrades > 0 ? Math.round((yearWins / yearTotalTrades) * 100) : 0,
    };
  }), [daily, years]);

  if (!daily || daily.length === 0) {
    return (
      <div className={`${card} ${fill ? 'flex h-full min-h-0 items-center justify-center' : ''} ${cardBody}`}>
        <div className={emptyState}>No data available for heatmap.</div>
      </div>
    );
  }

  const cellClass = fill
    ? 'flex h-[4.25rem] flex-col items-center justify-center rounded-lg px-1 text-center'
    : 'flex h-16 flex-col items-center justify-center rounded-lg px-1 text-center sm:h-20';

  return (
    <div className={`${card} overflow-hidden ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={`${cardHd} shrink-0`}>
        <div>
          <h3 className={cardTitle}>Monthly heatmap</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            PnL by month
          </p>
        </div>
        <p className="hidden text-xs text-zinc-400 sm:block">
          {yearData.length} year{yearData.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className={`${fill ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto'} p-4 md:p-5`}>
        <div
          className="grid min-w-[760px] content-start"
          style={{
            gridTemplateColumns: '72px repeat(12, minmax(0, 1fr)) 96px',
            gap: '6px',
          }}
        >
          <div />
          {MONTHS_SHORT.map((m) => (
            <div
              key={m}
              className="flex items-end justify-center pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400"
            >
              {m}
            </div>
          ))}
          <div className="flex items-end justify-center pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Total
          </div>

          {yearData.map((yd) => (
            <div className="contents" key={yd.year}>
              <div className="flex flex-col items-center justify-center py-1">
                <div className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{yd.year}</div>
                <div className="text-[10px] text-zinc-500">{yd.yearWr}% WR</div>
              </div>

              {yd.months.map((m) => {
                const tone = monthTone(m.pnl, m.hasActivity);
                return (
                  <div
                    key={m.month}
                    className={`${cellClass} ${tone.bg} ${tone.border}`}
                    title={m.hasActivity
                      ? `${MONTHS_SHORT[m.month - 1]} ${yd.year}: ${fmtPnlStrict(m.pnl, denomination)} · ${m.trades} trades`
                      : `${MONTHS_SHORT[m.month - 1]} ${yd.year}: no trades`}
                  >
                    {m.hasActivity ? (
                      <>
                        <span className={`text-[11px] font-bold tabular-nums leading-tight sm:text-xs ${tone.text}`}>
                          {compactPnl(m.pnl, denomination)}
                        </span>
                        <span className={`mt-0.5 text-[10px] ${tone.text} opacity-70`}>
                          {m.trades}t
                        </span>
                      </>
                    ) : (
                      <span className={`text-[10px] ${tone.text}`}>·</span>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-center">
                <div
                  className={`${cellClass} w-full px-2 text-[11px] font-bold tabular-nums sm:text-xs ${
                    yd.yearTotalPnl > 0
                      ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/15 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : yd.yearTotalPnl < 0
                        ? 'border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:border-rose-500/15 dark:bg-rose-500/20 dark:text-rose-400'
                        : 'border border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800'
                  }`}
                >
                  {compactPnl(yd.yearTotalPnl, denomination)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
