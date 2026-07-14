import { getTradesToGoalSummary } from '../../lib/compounding/tradesToGoal';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { card, cardBody } from '../../lib/ui';

export default function TradesToGoalSummary({ config, currentBalance }) {
  const { atGoal, winsFromStart, winsRemaining } = getTradesToGoalSummary(config, currentBalance);

  return (
    <div className={`${card} ${cardBody} border-violet-100 bg-violet-50/40`}>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        Trades to reach {formatMoney(config.targetBalance)}
      </p>
      {atGoal ? (
        <p className="text-lg font-semibold text-emerald-600">Goal reached — you hit your target balance.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-zinc-500">Wins needed from now</p>
            <p className="text-3xl font-bold tabular-nums text-violet-700">{winsRemaining}</p>
            <p className="mt-1 text-xs text-zinc-400">
              If every trade from {formatMoney(currentBalance)} is a win at {config.targetProfitPercent}%
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-zinc-500">Full all-win plan from start</p>
            <p className="text-3xl font-bold tabular-nums text-zinc-900">{winsFromStart}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {formatMoney(config.startingBalance)} → {formatMoney(config.targetBalance)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
