import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import {
  buildAccountLookups,
  groupTradesByAccount,
  accountTypeLabel,
  resolveTradeAccount,
} from '../lib/accounts';
import { computeStats } from '../lib/stats';
import { card, cardBody, cardHd, cardTitle } from '../lib/ui';

function fmtPnl(v) {
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

export default function PortfolioBreakdown() {
  const { allTrades, tradingAccounts, excludeDemoFromPortfolio, setActiveAccountId } = useAppData();

  const groups = useMemo(() => {
    const lookups = buildAccountLookups(tradingAccounts);
    let trades = allTrades;
    if (excludeDemoFromPortfolio) {
      trades = trades.filter((t) => {
        const acc = resolveTradeAccount(t, lookups);
        return !acc || acc.account_type !== 'demo';
      });
    }
    return groupTradesByAccount(trades, tradingAccounts);
  }, [allTrades, tradingAccounts, excludeDemoFromPortfolio]);

  if (groups.length <= 1) return null;

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <div>
          <h3 className={cardTitle}>By account</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Tap to drill into an account</p>
        </div>
      </div>
      <div className="divide-y divide-zinc-100">
        {groups.map(({ account, trades }) => {
          const stats = computeStats(trades);
          const pnl = stats?.totalPnl || 0;
          const wr = stats?.wr ?? 0;
          const isUntagged = account.id === '__untagged';

          return (
            <button
              key={account.id}
              type="button"
              className={`${cardBody} flex w-full items-center justify-between gap-3 py-3.5 text-left transition hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-white`}
              onClick={() => { if (!isUntagged) setActiveAccountId(account.id); }}
              disabled={isUntagged}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: account.color || '#a1a1aa' }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">{account.name}</div>
                  {!isUntagged && (
                    <div className="text-xs text-zinc-400">{accountTypeLabel(account.account_type)}</div>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-sm font-bold ${pnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                  {fmtPnl(pnl)}
                </div>
                <div className="text-[11px] text-zinc-400">{wr}% WR · {trades.length} trades</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
