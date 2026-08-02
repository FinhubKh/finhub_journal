import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPublishedTradingAccount } from '../api/share';
import { computeStats } from '../lib/stats';
import { accountTypeLabel, pnlDenominationLabel, normalizePnlDenomination } from '../lib/accounts';
import { fmtPnlStrict } from '../lib/format';
import {
  btnOutline,
  btnPrimary,
  btnSm,
  card,
  cardBody,
  cardHd,
  cardTitle,
  dashboardPageWide,
  emptyState,
  pageShell,
  sectionLabel,
  tableTd,
  tableTh,
  tradeResultBadge,
} from '../lib/ui';
import EquityChart from '../components/dashboard/EquityChart';
import { BrandLogo } from '../components/BrandLogo';

const PAGE_SIZE = 20;

function StatTile({ label, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'positive'
      ? 'text-violet-600 dark:text-emerald-400'
      : tone === 'negative'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className={`${card} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function PublicSharePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    fetchPublishedTradingAccount(token)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          setData(null);
          setError('This share link is invalid or the account is no longer public.');
          return;
        }
        setData(payload);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Could not load this shared account.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const trades = data?.trades ?? [];
  const tradeCount = data?.tradeCount ?? trades.length;
  const tradesCapped = Boolean(data?.tradesCapped);
  const stats = useMemo(() => (trades.length ? computeStats(trades) : null), [trades]);

  const totalPages = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const pageTrades = trades.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className={pageShell}>
        <div className={`${dashboardPageWide} py-16`}>
          <p className="text-sm text-zinc-400">Loading shared account…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={pageShell}>
        <div className={`${dashboardPageWide} py-16`}>
          <div className={`${card} ${cardBody} max-w-lg`}>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Link unavailable</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{error || 'Not found.'}</p>
            <Link to="/" className={`${btnOutline} mt-5 inline-flex`}>
              Back to FinHub Journal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { account, owner } = data;
  const denomination = normalizePnlDenomination(account.pnl_denomination);
  const pfNum = stats ? parseFloat(stats.pf) : NaN;

  return (
    <div className={pageShell}>
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
        <div className={`${dashboardPageWide} flex flex-wrap items-center justify-between gap-3 !pb-4 !pt-4`}>
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2">
            <Link to="/leaderboard" className={`${btnOutline} !px-4 !py-2 text-xs`}>
              Leaderboard
            </Link>
            <Link to="/login" className={`${btnPrimary} !px-4 !py-2 text-xs`}>
              Open your journal
            </Link>
          </div>
        </div>
      </header>

      <main className={`${dashboardPageWide} !pt-6`}>
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 dark:text-emerald-400">Shared trading account</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">{account.name}</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Shared by <span className="font-medium text-zinc-800 dark:text-zinc-200">{owner.display_name}</span>
            {' · '}
            {accountTypeLabel(account.account_type)}
            {' · '}
            {pnlDenominationLabel(account.pnl_denomination)}
            {account.broker ? ` · ${account.broker}` : ''}
          </p>
        </div>

        {!trades.length ? (
          <div className={`${card} ${emptyState}`}>No trades on this account yet.</div>
        ) : (
          <div className="space-y-6">
            {tradesCapped ? (
              <p className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                Showing the latest {trades.length.toLocaleString()} of {tradeCount.toLocaleString()} trades.
                Stats and equity below use this window.
              </p>
            ) : null}
            <section>
              <h2 className={`${sectionLabel} mb-3`}>Summary</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label="Net result"
                  value={fmtPnlStrict(stats.totalPnl, denomination)}
                  tone={stats.totalPnl >= 0 ? 'positive' : 'negative'}
                />
                <StatTile
                  label="Win rate"
                  value={`${stats.wr}%`}
                  tone={stats.wr >= 50 ? 'positive' : 'negative'}
                />
                <StatTile
                  label="Profit factor"
                  value={String(stats.pf)}
                  tone={!Number.isNaN(pfNum) && pfNum >= 1 ? 'positive' : 'neutral'}
                />
                <StatTile label="Trades" value={String(stats.total)} />
              </div>
            </section>

            <section>
              <h2 className={`${sectionLabel} mb-3`}>Equity</h2>
              <EquityChart trades={trades} denomination={denomination} />
            </section>

            <section>
              <div className={`${card} overflow-hidden`}>
                <div className={cardHd}>
                  <h2 className={cardTitle}>Trade history</h2>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {tradesCapped
                      ? `${trades.length} shown · ${tradeCount} total`
                      : `${trades.length} trades`}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className={tableTh}>Date</th>
                        <th className={tableTh}>Symbol</th>
                        <th className={tableTh}>Side</th>
                        <th className={tableTh}>Result</th>
                        <th className={`${tableTh} text-right`}>R</th>
                        <th className={`${tableTh} text-right`}>PnL</th>
                        <th className={tableTh}>Session</th>
                        <th className={tableTh}>Model</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {pageTrades.map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition">
                          <td className={`${tableTd} tabular-nums text-zinc-600 dark:text-zinc-400`}>{t.date}</td>
                          <td className={tableTd}>{t.symbol || '—'}</td>
                          <td className={`${tableTd} capitalize`}>{t.direction || '—'}</td>
                          <td className={tableTd}>
                            <span className={tradeResultBadge(t.result)}>{t.result}</span>
                          </td>
                          <td className={`${tableTd} text-right tabular-nums`}>
                            {t.r_value != null ? Number(t.r_value).toFixed(2) : '—'}
                          </td>
                          <td
                            className={`${tableTd} text-right tabular-nums font-medium ${
                              Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {fmtPnlStrict(t.pnl_usd, denomination)}
                          </td>
                          <td className={`${tableTd} capitalize`}>{t.session || '—'}</td>
                          <td className={`${tableTd} text-zinc-500 dark:text-zinc-400`}>{t.model || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 px-4 py-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {trades.length > PAGE_SIZE
                      ? `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, trades.length)} of ${trades.length}`
                      : `${trades.length} trade${trades.length === 1 ? '' : 's'}`}
                  </span>
                  {trades.length > PAGE_SIZE && (
                    <div className="flex items-center gap-2">
                      <button
                        className={btnSm}
                        type="button"
                        disabled={pageSafe <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="min-w-[88px] text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Page {pageSafe} / {totalPages}
                      </span>
                      <button
                        className={btnSm}
                        type="button"
                        disabled={pageSafe >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
