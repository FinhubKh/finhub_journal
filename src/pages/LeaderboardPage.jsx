import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCachedPublicLeaderboard } from '../lib/leaderboardCache';
import { accountTypeLabel } from '../lib/accounts';
import {
  btnOutline,
  btnPrimary,
  card,
  dashboardPageWide,
  emptyState,
  pageShell,
  pillBtn,
  pillToggle,
  sectionLabel,
  tableTd,
  tableTh,
} from '../lib/ui';

const SORTS = [
  { id: 'pnl', label: 'Net PnL' },
  { id: 'wr', label: 'Win rate' },
  { id: 'pf', label: 'Profit factor' },
];

function fmtPnl(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function fmtPf(v) {
  if (v === Infinity) return '∞';
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toFixed(2);
}

function pfSortValue(v) {
  if (v === Infinity) return Number.POSITIVE_INFINITY;
  if (v == null || Number.isNaN(v)) return Number.NEGATIVE_INFINITY;
  return Number(v);
}

function RankBadge({ rank }) {
  const podium =
    rank === 1
      ? 'bg-amber-100 text-amber-800 ring-amber-200'
      : rank === 2
        ? 'bg-zinc-100 text-zinc-700 ring-zinc-200'
        : rank === 3
          ? 'bg-orange-50 text-orange-800 ring-orange-200'
          : 'bg-zinc-50 text-zinc-500 ring-zinc-200';
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ring-1 ring-inset ${podium}`}>
      {rank}
    </span>
  );
}

function LeaderboardTable({ entries, sort, embedded }) {
  if (!entries.length) {
    return (
      <div className={`${card} ${emptyState}`}>
        <p>No published accounts qualify yet.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Publish an account with enough trades to appear here.
        </p>
        {embedded ? (
          <Link to="/dashboard" state={{ tab: 'settings', section: 'trading-accounts' }} className={`${btnOutline} mt-4 inline-flex`}>
            Go to Settings
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className={`${tableTh} w-14`}>#</th>
              <th className={tableTh}>Trader</th>
              <th className={tableTh}>Account</th>
              <th className={`${tableTh} text-right ${sort === 'pnl' ? 'text-violet-700' : ''}`}>Net PnL</th>
              <th className={`${tableTh} text-right ${sort === 'wr' ? 'text-violet-700' : ''}`}>Win rate</th>
              <th className={`${tableTh} text-right ${sort === 'pf' ? 'text-violet-700' : ''}`}>PF</th>
              <th className={`${tableTh} text-right`}>Trades</th>
              <th className={`${tableTh} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {entries.map((e) => (
              <tr key={e.accountId} className="hover:bg-zinc-50/80">
                <td className={tableTd}>
                  <RankBadge rank={e.displayRank} />
                </td>
                <td className={tableTd}>
                  <div className="font-semibold text-zinc-900">{e.displayName}</div>
                </td>
                <td className={tableTd}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color || '#7c3aed' }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-800">{e.accountName}</div>
                      <div className="text-[11px] text-zinc-400">{accountTypeLabel(e.accountType)}</div>
                    </div>
                  </div>
                </td>
                <td
                  className={`${tableTd} text-right tabular-nums font-semibold ${
                    e.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'
                  }`}
                >
                  {fmtPnl(e.totalPnl)}
                </td>
                <td className={`${tableTd} text-right tabular-nums`}>{e.winRate}%</td>
                <td className={`${tableTd} text-right tabular-nums`}>{fmtPf(e.profitFactor)}</td>
                <td className={`${tableTd} text-right tabular-nums text-zinc-500`}>{e.tradeCount}</td>
                <td className={`${tableTd} text-right`}>
                  {e.shareToken ? (
                    <Link
                      to={`/share/${e.shareToken}`}
                      className="text-xs font-semibold text-violet-600 transition hover:text-violet-500"
                    >
                      View
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * @param {{ embedded?: boolean }} props
 * embedded=true → dashboard tab (no pageShell). false → public /leaderboard page.
 */
export default function LeaderboardPage({ embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [sort, setSort] = useState('pnl');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCachedPublicLeaderboard({ limit: 50, minTrades: 5 })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Could not load leaderboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const list = [...(payload?.entries || [])];
    if (sort === 'wr') {
      list.sort((a, b) => b.winRate - a.winRate || b.totalPnl - a.totalPnl);
    } else if (sort === 'pf') {
      list.sort((a, b) => pfSortValue(b.profitFactor) - pfSortValue(a.profitFactor) || b.totalPnl - a.totalPnl);
    } else {
      list.sort((a, b) => b.totalPnl - a.totalPnl || b.tradeCount - a.tradeCount);
    }
    return list.map((e, i) => ({ ...e, displayRank: i + 1 }));
  }, [payload, sort]);

  const body = (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`${sectionLabel} !mb-1`}>Community</p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Leaderboard</h1>
          <p className="mt-1.5 max-w-xl text-sm text-zinc-500">
            Rankings of published trading accounts
            {payload?.minTrades ? ` with at least ${payload.minTrades} trades` : ''}.
            Open any profile to see full stats and history.
          </p>
        </div>
        <div className={pillToggle} role="tablist" aria-label="Sort leaderboard">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={sort === s.id}
              className={pillBtn(sort === s.id)}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading leaderboard…</p>
      ) : error ? (
        <div className={`${card} p-5`}>
          <p className="text-sm font-medium text-zinc-900">Could not load leaderboard</p>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
          <p className="mt-3 text-xs text-zinc-400">
            Run <code className="rounded bg-zinc-100 px-1 py-0.5">backend/schema_leaderboard.sql</code> in the Supabase SQL Editor, then refresh.
          </p>
        </div>
      ) : (
        <LeaderboardTable entries={sorted} sort={sort} embedded={embedded} />
      )}
    </>
  );

  if (embedded) {
    return <div className={`${dashboardPageWide} !pt-6`}>{body}</div>;
  }

  return (
    <div className={pageShell}>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className={`${dashboardPageWide} flex flex-wrap items-center justify-between gap-3 !pb-4 !pt-4`}>
          <Link to="/" className="text-sm font-bold text-zinc-900">
            FinhubKH <span className="font-medium text-zinc-400">Journal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className={`${btnOutline} !px-4 !py-2 text-xs`}>
              Sign in
            </Link>
            <Link to="/login" className={`${btnPrimary} !px-4 !py-2 text-xs`}>
              Open your journal
            </Link>
          </div>
        </div>
      </header>
      <main className={`${dashboardPageWide} !pt-6`}>{body}</main>
    </div>
  );
}
