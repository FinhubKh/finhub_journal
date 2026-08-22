import { computePeriodPacing } from '../../lib/aiAdvisorHelpers';

export default function PacingBar({ summary, previousSummary, previousBusy }) {
  if (!summary || summary.trade_count === 0) return null;

  if (previousBusy) {
    return <div className="h-[74px] animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  }

  const { hasComparison, pct } = computePeriodPacing(summary, previousSummary);

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
        Pacing vs previous period
      </p>
      {hasComparison ? (
        <>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {pct}% of your previous period&apos;s win rate
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">No prior period to compare.</p>
      )}
    </div>
  );
}
