import { useMemo } from 'react';
import { useAppData } from '../../context/AppDataContext';
import {
  accountTypeLabel,
  normalizePnlDenomination,
} from '../../lib/accounts';
import { fmtPnlStrict } from '../../lib/format';
import { card, cardBody, cardHd, cardTitle } from '../../lib/ui';

export default function PortfolioBreakdown({ fill = false }) {
  const { journalAccounts, tradingAccounts, setActiveAccountId } = useAppData();

  const rows = useMemo(() => {
    const byId = Object.fromEntries(tradingAccounts.map((a) => [a.id, a]));
    return (journalAccounts || [])
      .map((row) => {
        const account = byId[row.account_id];
        if (!account) return null;
        const tradeCount = Number(row.trade_count) || 0;
        if (tradeCount <= 0) return null;
        const wins = Number(row.wins) || 0;
        const wr = tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0;
        return {
          account,
          tradeCount,
          wr,
          pnl: Number(row.total_pnl) || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.pnl - a.pnl);
  }, [journalAccounts, tradingAccounts]);

  if (rows.length <= 1) return null;

  return (
    <div className={`${card} overflow-hidden ${fill ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <div className={`${cardHd} shrink-0`}>
        <div>
          <h3 className={cardTitle}>By account</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Tap to drill into an account</p>
        </div>
      </div>
      <div
        className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${
          fill ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[280px] overflow-y-auto'
        }`}
      >
        {rows.map(({ account, tradeCount, wr, pnl }) => {
          const denomination = normalizePnlDenomination(account.pnl_denomination);

          return (
            <button
              key={account.id}
              type="button"
              className={`${cardBody} flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60`}
              onClick={() => setActiveAccountId(account.id)}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-950"
                  style={{ backgroundColor: account.color || '#a1a1aa' }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{account.name}</div>
                  <div className="text-xs text-zinc-400 dark:text-zinc-500">{accountTypeLabel(account.account_type)}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {wr}% WR
                </span>
                <span className={`font-semibold tabular-nums ${pnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fmtPnlStrict(pnl, denomination)}
                </span>
                <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{tradeCount}t</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
