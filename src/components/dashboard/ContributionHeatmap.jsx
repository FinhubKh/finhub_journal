import { useMemo } from 'react';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';
import { fmtPnlStrict } from '../../lib/format';

export default function ContributionHeatmap({ daily, year, denomination = 'usd', fill = false, action = null }) {
  const grid = useMemo(() => {
    if (!year) return [];
    
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    
    const startOffset = start.getDay(); 
    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - startOffset);

    const endOffset = 6 - end.getDay();
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + endOffset);

    const map = new Map();
    (daily || []).forEach(d => {
      if (d.date) map.set(d.date, d);
    });

    let maxWin = 0;
    let maxLoss = 0;
    for (const d of (daily || [])) {
       const pnl = Number(d.pnl) || 0;
       if (pnl > maxWin) maxWin = pnl;
       if (pnl < maxLoss) maxLoss = pnl;
    }

    const weeks = [];
    let current = new Date(gridStart);
    let currentWeek = [];
    
    while (current <= gridEnd) {
      const dateStr = current.toISOString().split('T')[0];
      const data = map.get(dateStr);
      const pnl = data ? (Number(data.pnl) || 0) : 0;
      const trades = data ? (data.trade_count || 0) : 0;
      
      let colorClass = 'bg-zinc-100 dark:bg-zinc-800/80';
      if (trades > 0) {
        if (pnl > 0) {
           const intensity = maxWin > 0 ? pnl / maxWin : 0;
           if (intensity > 0.75) colorClass = 'bg-emerald-500 dark:bg-emerald-400';
           else if (intensity > 0.5) colorClass = 'bg-emerald-400 dark:bg-emerald-500';
           else if (intensity > 0.25) colorClass = 'bg-emerald-300 dark:bg-emerald-600';
           else colorClass = 'bg-emerald-200 dark:bg-emerald-700/80';
        } else if (pnl < 0) {
           const intensity = maxLoss < 0 ? pnl / maxLoss : 0;
           if (intensity > 0.75) colorClass = 'bg-rose-500 dark:bg-rose-500';
           else if (intensity > 0.5) colorClass = 'bg-rose-400 dark:bg-rose-600';
           else if (intensity > 0.25) colorClass = 'bg-rose-300 dark:bg-rose-700';
           else colorClass = 'bg-rose-200 dark:bg-rose-800/60';
        } else {
           colorClass = 'bg-amber-400 dark:bg-amber-600';
        }
      }

      currentWeek.push({
        date: dateStr,
        pnl,
        trades,
        colorClass,
        inYear: current.getFullYear() === year
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      current.setDate(current.getDate() + 1);
    }
    
    return weeks;
  }, [daily, year]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className={`${card} overflow-hidden ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={`${cardHd} flex items-center justify-between shrink-0`}>
        <div>
          <h3 className={cardTitle}>Daily Consistency</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">PnL heatmap for {year}</p>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div className={`${cardBody} flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar`}>
        <div className="flex min-w-max gap-1">
          <div className="flex flex-col gap-1 pr-2 pt-5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            <span className="flex-1">Mon</span>
            <span className="flex-1">Wed</span>
            <span className="flex-1">Fri</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1">
              {grid.map((week, i) => {
                const day = week.find(d => d.inYear && d.date.endsWith('-01'));
                if (day) {
                  const m = parseInt(day.date.split('-')[1], 10) - 1;
                  return <div key={`m-${i}`} className="w-3 relative"><span className="absolute -left-1">{months[m]}</span></div>;
                }
                return <div key={`w-${i}`} className="w-3"></div>;
              })}
            </div>
            
            <div className="flex gap-1">
              {grid.map((week, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {week.map((day, j) => (
                    <div
                      key={j}
                      title={day.inYear ? `${day.date}: ${day.trades > 0 ? fmtPnlStrict(day.pnl, denomination) : 'No trades'} (${day.trades} trades)` : ''}
                      className={`h-3 w-3 rounded-sm ${day.inYear ? day.colorClass : 'bg-transparent'} ${day.inYear && day.trades > 0 ? 'hover:ring-1 hover:ring-zinc-400 dark:hover:ring-zinc-500 cursor-pointer' : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
