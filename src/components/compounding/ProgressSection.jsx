import { generateMilestones, getNextMilestone } from '../../lib/compounding/milestones';
import { formatMoney } from '../../lib/compounding/formatMoney';
import { card, cardBody } from '../../lib/ui';

export default function ProgressSection({ startingBalance, currentBalance, targetBalance, progressPercent }) {
  const nextMilestone = getNextMilestone(generateMilestones(startingBalance, targetBalance), currentBalance);

  return (
    <div className={`${card} ${cardBody}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Progress to target</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900">{progressPercent.toFixed(1)}%</p>
        </div>
        <div className="text-right text-sm tabular-nums text-zinc-500">
          <div>{formatMoney(currentBalance)}</div>
          <div className="text-zinc-400">of {formatMoney(targetBalance)}</div>
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-violet-600 transition-all"
          style={{ width: `${Math.min(100, progressPercent)}%` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-xs tabular-nums text-zinc-400">
        <span>{formatMoney(startingBalance)}</span>
        {nextMilestone ? <span className="text-violet-600">Next: {formatMoney(nextMilestone)}</span> : null}
        <span>{formatMoney(targetBalance)}</span>
      </div>
    </div>
  );
}
