import { useMemo } from 'react';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';
import { fmtPnlStrict } from '../../lib/format';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HighlightsCard({ overview, daily, denomination = 'usd', fill = false }) {
  const { bestDay, bestSession, bestTrade, worstTrade, winStreak, lossStreak, bestYear, bestMonth } = useMemo(() => {
    let maxTrade = overview?.breakdown?.maxTradeProfit || 0;
    
    // Best session
    let bSessionName = '—';
    let bSessionPnl = 0;
    const sessions = overview?.breakdown?.session || [];
    for (const s of sessions) {
      if (s.pnl > bSessionPnl) {
        bSessionPnl = s.pnl;
        bSessionName = s.name.charAt(0).toUpperCase() + s.name.slice(1);
      }
    }

    // Best day of week, best year, best month
    const daysPnl = new Array(7).fill(0);
    const yearPnl = {};
    const monthPnl = {};
    
    for (const d of (daily || [])) {
      if (!d.date) continue;
      
      const pnl = Number(d.pnl) || 0;
      const dIndex = new Date(`${d.date}T12:00:00Z`).getDay();
      daysPnl[dIndex] += pnl;
      
      const year = d.date.substring(0, 4);
      const month = d.date.substring(0, 7);
      
      yearPnl[year] = (yearPnl[year] || 0) + pnl;
      monthPnl[month] = (monthPnl[month] || 0) + pnl;
    }
    
    let bDayName = '—';
    let bDayPnl = 0;
    for (let i = 0; i < 7; i++) {
      if (daysPnl[i] > bDayPnl) {
        bDayPnl = daysPnl[i];
        bDayName = DAYS_OF_WEEK[i];
      }
    }

    let bYearName = '—';
    let bYearPnl = 0;
    for (const [y, pnl] of Object.entries(yearPnl)) {
      if (pnl > bYearPnl) {
        bYearPnl = pnl;
        bYearName = y;
      }
    }
    
    let bMonthName = '—';
    let bMonthPnl = 0;
    for (const [m, pnl] of Object.entries(monthPnl)) {
      if (pnl > bMonthPnl) {
        bMonthPnl = pnl;
        const [yy, mm] = m.split('-');
        const dateObj = new Date(parseInt(yy, 10), parseInt(mm, 10) - 1, 1);
        bMonthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
    }

    return { 
      bestDay: bDayName,
      bestSession: bSessionName,
      bestTrade: maxTrade,
      worstTrade: overview?.breakdown?.largestLoss || 0,
      winStreak: overview?.breakdown?.maxConsWins || 0,
      lossStreak: overview?.breakdown?.maxConsLosses || 0,
      bestYear: bYearName,
      bestMonth: bMonthName,
    };
  }, [overview, daily]);

  return (
    <div className={`${card} overflow-hidden ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={`${cardHd} shrink-0`}>
        <div>
          <h3 className={cardTitle}>Highlights & Streaks</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Extremes and most profitable segments</p>
        </div>
      </div>
      <div className={`${cardBody} flex-1 overflow-y-auto`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Best trade</p>
            <p className="mt-1 text-lg font-bold text-violet-600 dark:text-emerald-400">
              {bestTrade > 0 ? fmtPnlStrict(bestTrade, denomination) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Worst trade</p>
            <p className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
              {worstTrade < 0 ? fmtPnlStrict(worstTrade, denomination) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Win streak</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {winStreak > 0 ? winStreak : '—'}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-zinc-400">Consecutive wins</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Loss streak</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {lossStreak > 0 ? lossStreak : '—'}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-zinc-400">Consecutive losses</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Best day</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {bestDay}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Best session</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {bestSession}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Best year</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {bestYear}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Best month</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {bestMonth}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
