import { computeRiskState } from '../../lib/aiAdvisorHelpers';

const RISK_COPY = {
  calm: {
    label: 'CALM',
    detail: 'No elevated risk signals for this period.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  elevated: {
    label: 'ELEVATED',
    detail: 'Losing streak or drawdown approaching your half-Kelly risk ceiling.',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  alert: {
    label: 'ALERT',
    detail: 'Drawdown or losing streak has crossed your risk ceiling — consider reducing size.',
    className: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
};

export default function RiskBanner({ summary }) {
  if (!summary || summary.trade_count === 0) return null;

  const state = computeRiskState(summary);
  const copy = RISK_COPY[state];
  const streak = summary.streaks?.current_streak;
  const streakText = streak?.type === 'loss' && streak.count > 0 ? `${streak.count}-loss streak` : null;
  const drawdownText = summary.max_drawdown?.pct ? `${summary.max_drawdown.pct.toFixed(1)}% drawdown` : null;
  const detailText = [streakText, drawdownText].filter(Boolean).join(' · ') || copy.detail;

  return (
    <div className={`flex flex-wrap items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${copy.className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
      <span className="font-bold tracking-wide">{copy.label}</span>
      <span className="text-xs font-normal opacity-90">{detailText}</span>
    </div>
  );
}
