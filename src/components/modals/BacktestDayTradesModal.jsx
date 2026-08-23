import { useEffect, useMemo } from 'react';
import { fmtLot, fmtPnlStrict } from '../../lib/format';
import {
  btnGhost,
  card,
  tableTd,
  tableTh,
  tradeResultBadge,
} from '../../lib/ui';

export default function BacktestDayTradesModal({
  date,
  trades = [],
  denomination = 'usd',
  dayPnl = 0,
  onClose,
}) {
  const label = useMemo(
    () => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    [date],
  );

  const sorted = useMemo(
    () => [...trades].sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))),
    [trades],
  );

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${card} flex max-h-[min(88vh,720px)] w-full max-w-3xl flex-col overflow-hidden shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backtest-day-trades-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 id="backtest-day-trades-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Trading log
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                {sorted.length} trade{sorted.length !== 1 ? 's' : ''}
              </span>
              {' · '}
              <span className={`font-semibold tabular-nums ${dayPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {fmtPnlStrict(dayPnl, denomination)}
              </span>
            </p>
          </div>
          <button className={btnGhost} type="button" onClick={onClose}>Close</button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {sorted.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No trade details for this day.
              <span className="mt-1 block text-xs text-zinc-400">
                Re-upload the MT5 report to store the trading log.
              </span>
            </div>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className={tableTh}>Time</th>
                  <th className={tableTh}>Symbol</th>
                  <th className={tableTh}>Side</th>
                  <th className={`${tableTh} text-right`}>Lot</th>
                  <th className={tableTh}>Result</th>
                  <th className={`${tableTh} text-right`}>PnL</th>
                  <th className={tableTh}>Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {sorted.map((t, i) => (
                  <tr
                    key={`${t.deal || i}-${t.time || i}`}
                    className="transition hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                  >
                    <td className={`${tableTd} tabular-nums text-zinc-600 dark:text-zinc-400`}>
                      {t.time || '—'}
                    </td>
                    <td className={tableTd}>{t.symbol || '—'}</td>
                    <td className={`${tableTd} capitalize`}>{t.direction || '—'}</td>
                    <td className={`${tableTd} text-right tabular-nums`}>{fmtLot(t.volume)}</td>
                    <td className={tableTd}>
                      <span className={tradeResultBadge(t.result)}>{t.result}</span>
                    </td>
                    <td className={`${tableTd} text-right tabular-nums font-medium ${Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {fmtPnlStrict(t.pnl_usd, denomination)}
                    </td>
                    <td className={`${tableTd} capitalize`}>{t.session || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
