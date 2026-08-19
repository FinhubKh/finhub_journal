import { useMemo } from 'react';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';
import { fmtPnlStrict } from '../../lib/format';

export default function RiskCard({ overview, daily, denomination = 'usd', fill = false }) {
  const maxDD = useMemo(() => {
    if (!daily || !daily.length) return 0;
    let peak = 0;
    let cum = 0;
    let max = 0;
    for (const d of daily) {
      cum += Number(d.pnl) || 0;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > max) max = dd;
    }
    return max;
  }, [daily]);

  const trades = Number(overview?.trade_count ?? overview?.tradeCount) || 0;
  const totalPnl = Number(overview?.total_pnl ?? overview?.totalPnl) || 0;
  const expectancy = trades > 0 ? totalPnl / trades : 0;
  
  const pf = Number(overview?.profit_factor ?? overview?.profitFactor);
  const pfStr = !Number.isFinite(pf) ? '—' : pf > 999 ? '∞' : pf.toFixed(2);

  const beCount = Number(overview?.be_count ?? overview?.beCount) || 0;
  
  const trueMaxDd = Number(overview?.breakdown?.maxDdAmount) || 0;
  const trueMaxDdPercent = Number(overview?.breakdown?.maxDdPercent) || 0;
  const sharpe = Number(overview?.breakdown?.sharpeRatio) || 0;
  const recovery = Number(overview?.breakdown?.recoveryFactor) || 0;

  return (
    <div className={`${card} overflow-hidden ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={`${cardHd} shrink-0`}>
        <div>
          <h3 className={cardTitle}>Risk exposure</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Drawdown & performance metrics</p>
        </div>
      </div>
      <div className={`${cardBody} flex-1 overflow-y-auto`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Max drawdown</p>
            <p className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
              {trueMaxDd > 0 ? fmtPnlStrict(-trueMaxDd, denomination) : (maxDD > 0 ? fmtPnlStrict(-maxDD, denomination) : '—')}
            </p>
            {trueMaxDdPercent > 0 && <p className="mt-0.5 text-[10px] font-medium text-zinc-400">{trueMaxDdPercent}% peak</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Sharpe ratio</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {sharpe > 0 ? sharpe.toFixed(2) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Recovery factor</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {recovery > 0 ? recovery.toFixed(2) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Profit factor</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {pfStr}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Expectancy</p>
            <p className={`mt-1 text-lg font-bold ${expectancy >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {expectancy !== 0 ? fmtPnlStrict(expectancy, denomination) : '—'}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-zinc-400">Per trade</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Break-evens</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
              {beCount}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-zinc-400">Trades at zero</p>
          </div>
        </div>
      </div>
    </div>
  );
}
