import { useMemo } from 'react';
import { fmtPnlStrict } from '../../lib/format';
import { MONTHS_SHORT, bucketDailyByMonth, periodTotals, yearsFromDates } from '../../lib/calendarCells';
import { card, cardBody } from '../../lib/ui';

export default function HeatmapView({ daily, denomination = 'usd' }) {
  const years = useMemo(() => {
    const y = yearsFromDates(daily);
    // Sort descending (newest year first)
    return [...y].sort((a, b) => b - a);
  }, [daily]);

  const yearData = useMemo(() => {
    return years.map(year => {
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
        // Approximation of losses since we might have BE trades, but let's use actualTrades - wins if we don't have losses tracked correctly in periodTotals
        
        return {
          month: monthIndex,
          pnl: totals.pnl,
          trades: totals.trades,
          hasActivity: totals.trades > 0 || totals.pnl !== 0
        };
      });

      const yearWr = yearTotalTrades > 0 ? Math.round((yearWins / yearTotalTrades) * 100) : 0;

      return {
        year,
        months,
        yearTotalPnl,
        yearTotalTrades,
        yearWr
      };
    });
  }, [daily, years]);

  if (!daily || daily.length === 0) {
    return (
      <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>
        No data available for heatmap.
      </div>
    );
  }

  return (
    <div className="-mx-4 md:-mx-6 overflow-x-auto">
      <div className="min-w-[800px] px-4 pb-8 md:px-6">
        <div className="grid" style={{ gridTemplateColumns: '80px repeat(12, 1fr) 100px', gap: '8px' }}>
          {/* Header Row */}
          <div className="flex items-end justify-center pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500"></div>
          {MONTHS_SHORT.map((m) => (
            <div key={m} className="flex items-end justify-center pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {m}
            </div>
          ))}
          <div className="flex items-end justify-center pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Total
          </div>

          {/* Year Rows */}
          {yearData.map((yd) => (
            <div className="contents" key={yd.year}>
              {/* Year Label */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{yd.year}</div>
                <div className="text-[10px] text-zinc-500">{yd.yearWr}% win</div>
              </div>

              {/* Month Cells */}
              {yd.months.map((m) => {
                if (!m.hasActivity) {
                  return (
                    <div key={m.month} className="flex h-16 flex-col items-center justify-center rounded-lg bg-zinc-50/50 dark:bg-[#1a1a1c] sm:h-20">
                      <span className="text-sm text-zinc-400 dark:text-zinc-600">—</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600">0t</span>
                    </div>
                  );
                }

                const isPositive = m.pnl > 0;
                const isNegative = m.pnl < 0;
                
                let bgClass = 'bg-zinc-100 dark:bg-zinc-800';
                let textClass = 'text-zinc-900 dark:text-zinc-100';
                
                if (isPositive) {
                  bgClass = 'bg-emerald-500/20 dark:bg-[#183a2c]';
                  textClass = 'text-emerald-600 dark:text-emerald-400';
                } else if (isNegative) {
                  bgClass = 'bg-rose-500/20 dark:bg-[#3f1d1d]';
                  textClass = 'text-rose-600 dark:text-rose-400';
                }

                return (
                  <div key={m.month} className={`flex h-16 flex-col items-center justify-center rounded-lg sm:h-20 ${bgClass}`}>
                    <span className={`text-sm font-bold sm:text-base ${textClass}`}>
                      {fmtPnlStrict(m.pnl, denomination)}
                    </span>
                    <span className={`text-[10px] ${textClass} opacity-80 sm:text-xs`}>
                      {m.trades}t
                    </span>
                  </div>
                );
              })}

              {/* Year Total Cell */}
              <div className="flex items-center justify-center">
                <div className={`flex w-full items-center justify-center rounded py-1.5 text-xs font-bold ${
                  yd.yearTotalPnl > 0 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                    : yd.yearTotalPnl < 0 
                      ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                }`}>
                  {fmtPnlStrict(yd.yearTotalPnl, denomination)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
