import { computeModelDisciplineStreak } from '../../lib/aiAdvisorHelpers';

export default function DisciplineStreak({ summary }) {
  if (!summary || summary.trade_count === 0) return null;

  const { count, total } = computeModelDisciplineStreak(summary.sample_trades);
  if (total === 0) return null;
  const full = count === total;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
        Strategy discipline
      </p>
      <p className="mt-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {full ? '🔥 ' : ''}
        {count} of your last {total} trade{total === 1 ? '' : 's'} used your defined entry model
      </p>
    </div>
  );
}
