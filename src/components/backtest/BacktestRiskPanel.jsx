import { fmtDateShort, fmtPnlStrict } from '../../lib/format';
import { card } from '../../lib/ui';

export function StatTile({ label, value, hint, tone = 'neutral' }) {
  const valueCls =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
        : 'text-zinc-900 dark:text-zinc-100';

  return (
    <div className={`${card} flex h-full min-h-0 flex-col justify-between p-3.5`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <div className={`mt-1.5 truncate text-lg font-bold tracking-tight tabular-nums sm:text-xl ${valueCls}`}>
        {value}
      </div>
      {hint ? <span className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{hint}</span> : null}
    </div>
  );
}

function formatRatio(value) {
  if (value === Infinity) return '∞';
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(2);
}

export default function BacktestRiskPanel({ risk, denomination = 'usd' }) {
  if (!risk) return null;

  return (
    <section
      aria-label="Risk"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto lg:overflow-hidden"
    >
      <div className="grid min-h-0 shrink-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Expectancy"
          value={fmtPnlStrict(risk.expectancy, denomination)}
          hint="Per trade"
          tone={risk.expectancy >= 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="Risk:Reward"
          value={risk.rrRatio == null ? '—' : `${formatRatio(risk.rrRatio)}:1`}
          hint="Avg win ÷ avg loss"
          tone={risk.rrRatio === Infinity || Number(risk.rrRatio) >= 1 ? 'positive' : 'neutral'}
        />
        <StatTile
          label="Avg win"
          value={risk.avgWin > 0 ? fmtPnlStrict(risk.avgWin, denomination) : '—'}
          tone="positive"
        />
        <StatTile
          label="Avg loss"
          value={risk.avgLoss > 0 ? fmtPnlStrict(-risk.avgLoss, denomination) : '—'}
          tone="negative"
        />
        <StatTile
          label="Max drawdown"
          value={risk.maxDD > 0 ? fmtPnlStrict(-risk.maxDD, denomination) : '—'}
          hint="Peak to trough"
          tone="negative"
        />
        <StatTile
          label="Recovery"
          value={formatRatio(risk.recovery)}
          hint="Net ÷ max drawdown"
          tone={risk.recovery === Infinity || Number(risk.recovery) >= 1 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Return"
          value={risk.returnPct == null ? '—' : `${risk.returnPct >= 0 ? '+' : ''}${risk.returnPct.toFixed(1)}%`}
          hint={risk.deposit > 0 ? `On ${fmtPnlStrict(risk.deposit, denomination)} deposit` : 'Upload again to read deposit'}
          tone={risk.returnPct == null ? 'neutral' : risk.returnPct >= 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="Profitable days"
          value={`${risk.profitableDaysPct}%`}
          hint={`${risk.activeDays} trading day${risk.activeDays !== 1 ? 's' : ''}`}
          tone={risk.profitableDaysPct >= 50 ? 'positive' : 'negative'}
        />
        <StatTile
          label="Best day"
          value={risk.bestDay ? fmtPnlStrict(risk.bestDay.pnl, denomination) : '—'}
          hint={risk.bestDay?.date ? fmtDateShort(risk.bestDay.date) : undefined}
          tone="positive"
        />
        <StatTile
          label="Worst day"
          value={risk.worstDay ? fmtPnlStrict(risk.worstDay.pnl, denomination) : '—'}
          hint={risk.worstDay?.date ? fmtDateShort(risk.worstDay.date) : undefined}
          tone="negative"
        />
        <div className={`${card} col-span-2 flex h-full min-h-0 flex-col justify-between p-3.5 xl:col-span-1`}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Day streaks
          </span>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-lg font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-xl">
                {risk.bestStreak > 0 ? `${risk.bestStreak}W` : '—'}
              </div>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Best run</span>
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400 sm:text-xl">
                {risk.worstStreak > 0 ? `${risk.worstStreak}L` : '—'}
              </div>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Worst run</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
