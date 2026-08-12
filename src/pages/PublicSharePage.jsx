import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPublishedTradingAccount } from '../api/share';
import { getSession, subscribeAuth } from '../api/auth';
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
import PublicCalendar from '../components/share/PublicCalendar';

const PAGE_SIZE = 20;

/* --- Tabs ---------------------------------------------------------- */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'log',      label: 'Trade Log' },
];

/* --- Stat tile ----------------------------------------------------- */
function StatTile({ label, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'positive' ? 'text-violet-600 dark:text-emerald-400'
    : tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
    : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className={`${card} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${toneClass}`}>{value}</div>
    </div>
  );
}

/* --- Tab bar ------------------------------------------------------- */
function TabBar({ active, onSelect }) {
  return (
    <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition ${
              isActive
                ? 'border-b-2 border-violet-600 dark:border-emerald-400 text-violet-700 dark:text-emerald-300 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/*
 * GateBanner
 * ───────────
 * Compact horizontal glass banner bar.
 */
function GateBanner({ feature = 'trade log', tradeCount, ownerName }) {
  const headline = tradeCount
    ? `Viewing 3 of ${tradeCount} Trades`
    : ownerName
    ? `Unlock ${ownerName}'s Full Journal`
    : `Unlock the Full ${feature === 'calendar' ? 'Calendar' : 'Trade Log'}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 sm:px-6">
      <div
        className="pointer-events-auto relative flex w-full max-w-4xl flex-col items-center justify-between gap-3.5 overflow-hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-4 sm:p-4 md:px-6 shadow-xl shadow-violet-500/10 dark:shadow-black/70 backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10 sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top gradient strip */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-600" />

        {/* Left Side: Lock Badge + Text */}
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 sm:text-base">
              {headline}
            </h3>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Create a free account to view full trades & daily P&L.
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              Free · No credit card required
            </p>
          </div>
        </div>

        {/* Right Side: CTAs */}
        <div className="flex shrink-0 items-center gap-2.5 w-full sm:w-auto">
          <Link
            to="/login"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.98]"
          >
            Sign In
          </Link>
          <Link
            to="/login?mode=signup"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-violet-500 active:scale-[0.98]"
          >
            Create Free Account →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* --- Gated section wrapper for Calendar tab --- */
function GatedCalendarSection({ children, ownerName }) {
  return (
    <div className="relative min-h-[460px] overflow-hidden rounded-2xl">
      {/* Blurred calendar underneath */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none overflow-hidden"
        style={{ filter: 'blur(6px)', opacity: 0.45 }}
      >
        {children}
      </div>

      {/* Soft gradient overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-white/20 to-white/70 dark:via-zinc-950/20 dark:to-zinc-950/70" />

      {/* Horizontal Gate Banner */}
      <GateBanner feature="calendar" ownerName={ownerName} />
    </div>
  );
}

/* --- Trade Log View Component -------------------------------------- */
function TradeLogView({ trades, denomination, isLoggedIn, page, setPage, totalPages, pageSafe, pageStart, pageTrades, tradeCount, tradesCapped }) {
  if (isLoggedIn) {
    return (
      <section>
        <div className={`${card} overflow-hidden`}>
          <div className={cardHd}>
            <h2 className={cardTitle}>Trade History</h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {tradesCapped ? `${trades.length} shown · ${tradeCount} total` : `${trades.length} trades`}
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
                    <td className={tableTd}><span className={tradeResultBadge(t.result)}>{t.result}</span></td>
                    <td className={`${tableTd} text-right tabular-nums`}>{t.r_value != null ? Number(t.r_value).toFixed(2) : '—'}</td>
                    <td className={`${tableTd} text-right tabular-nums font-medium ${Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
                <button className={btnSm} type="button" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                <span className="min-w-[88px] text-center text-xs font-medium text-zinc-600 dark:text-zinc-400">Page {pageSafe} / {totalPages}</span>
                <button className={btnSm} type="button" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* Logged-out Trade Log tab: Shows 3 crisp rows at top + 4 compact blurred rows underneath with GateBanner */
  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <h2 className={cardTitle}>Trade History</h2>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{trades.length} trades</span>
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
            {/* Top 3 clear rows */}
            {trades.slice(0, 3).map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition">
                <td className={`${tableTd} tabular-nums text-zinc-600 dark:text-zinc-400`}>{t.date}</td>
                <td className={tableTd}>{t.symbol || '—'}</td>
                <td className={`${tableTd} capitalize`}>{t.direction || '—'}</td>
                <td className={tableTd}><span className={tradeResultBadge(t.result)}>{t.result}</span></td>
                <td className={`${tableTd} text-right tabular-nums`}>{t.r_value != null ? Number(t.r_value).toFixed(2) : '—'}</td>
                <td className={`${tableTd} text-right tabular-nums font-medium ${Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fmtPnlStrict(t.pnl_usd, denomination)}
                </td>
                <td className={`${tableTd} capitalize`}>{t.session || '—'}</td>
                <td className={`${tableTd} text-zinc-500 dark:text-zinc-400`}>{t.model || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Compact blurred extension table (4 rows) with GateBanner */}
      <div className="relative border-t border-zinc-100 dark:border-zinc-800/60 min-h-[170px]">
        <div
          aria-hidden="true"
          className="pointer-events-none select-none overflow-hidden"
          style={{ filter: 'blur(5px)', opacity: 0.45 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {trades.slice(3, 7).map((t) => (
                  <tr key={t.id}>
                    <td className={`${tableTd} tabular-nums text-zinc-600 dark:text-zinc-400`}>{t.date}</td>
                    <td className={tableTd}>{t.symbol || '—'}</td>
                    <td className={`${tableTd} capitalize`}>{t.direction || '—'}</td>
                    <td className={tableTd}><span className={tradeResultBadge(t.result)}>{t.result}</span></td>
                    <td className={`${tableTd} text-right tabular-nums`}>{t.r_value != null ? Number(t.r_value).toFixed(2) : '—'}</td>
                    <td className={`${tableTd} text-right tabular-nums font-medium ${Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {fmtPnlStrict(t.pnl_usd, denomination)}
                    </td>
                    <td className={`${tableTd} capitalize`}>{t.session || '—'}</td>
                    <td className={`${tableTd} text-zinc-500 dark:text-zinc-400`}>{t.model || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backdrop gradient overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-white/30 to-white/90 dark:via-zinc-900/30 dark:to-zinc-900/90" />

        {/* Horizontal Gate Banner */}
        <GateBanner feature="trade log" tradeCount={tradeCount} />
      </div>
    </div>
  );
}

/* --- Main page ----------------------------------------------------- */
export default function PublicSharePage() {
  const { token } = useParams();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [activeTab, setActiveTab] = useState('overview');

  /* Auth — synchronous, no flicker */
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getSession());
  useEffect(() => subscribeAuth(() => setIsLoggedIn(!!getSession())), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    fetchPublishedTradingAccount(token)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) { setData(null); setError('This share link is invalid or the account is no longer public.'); return; }
        setData(payload);
      })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Could not load this shared account.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const trades      = data?.trades ?? [];
  const tradeCount  = data?.tradeCount ?? trades.length;
  const tradesCapped = Boolean(data?.tradesCapped);
  const stats       = useMemo(() => (trades.length ? computeStats(trades) : null), [trades]);

  const totalPages  = Math.max(1, Math.ceil(trades.length / PAGE_SIZE));
  const pageSafe    = Math.min(page, totalPages);
  const pageStart   = (pageSafe - 1) * PAGE_SIZE;
  const pageTrades  = trades.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  function handleTabSelect(tabId) {
    setActiveTab(tabId);
  }

  if (loading) {
    return (
      <div className={pageShell}>
        <div className={`${dashboardPageWide} py-16`}>
          <p className="text-sm text-zinc-400">Loading shared account...</p>
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
            <Link to="/" className={`${btnOutline} mt-5 inline-flex`}>Back to FinHub Journal</Link>
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
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
        <div className={`${dashboardPageWide} flex flex-wrap items-center justify-between gap-3 !pb-4 !pt-4`}>
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2">
            <Link to="/leaderboard" className={`${btnOutline} !px-4 !py-2 text-xs`}>Leaderboard</Link>
            {isLoggedIn
              ? <Link to="/dashboard" className={`${btnPrimary} !px-4 !py-2 text-xs`}>My Journal</Link>
              : <Link to="/login"     className={`${btnPrimary} !px-4 !py-2 text-xs`}>Open your journal</Link>
            }
          </div>
        </div>
      </header>

      <main className={`${dashboardPageWide} !pt-6`}>
        {/* Account identity */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 dark:text-emerald-400">Shared trading account</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">{account.name}</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Shared by <span className="font-medium text-zinc-800 dark:text-zinc-200">{owner.display_name}</span>
            {' · '}{accountTypeLabel(account.account_type)}
            {' · '}{pnlDenominationLabel(account.pnl_denomination)}
            {account.broker ? ` · ${account.broker}` : ''}
          </p>
        </div>

        {!trades.length ? (
          <div className={`${card} ${emptyState}`}>No trades on this account yet.</div>
        ) : (
          <div className="space-y-0">
            {tradesCapped && (
              <p className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                Showing the latest {trades.length.toLocaleString()} of {tradeCount.toLocaleString()} trades. Stats and equity below use this window.
              </p>
            )}

            {/* Clean Tab bar */}
            <TabBar active={activeTab} onSelect={handleTabSelect} />

            <div className="pt-6 space-y-6">

              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <>
                  <section>
                    <h2 className={`${sectionLabel} mb-3`}>Summary</h2>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <StatTile label="Net result"    value={fmtPnlStrict(stats.totalPnl, denomination)} tone={stats.totalPnl >= 0 ? 'positive' : 'negative'} />
                      <StatTile label="Win rate"      value={`${stats.wr}%`}      tone={stats.wr >= 50 ? 'positive' : 'negative'} />
                      <StatTile label="Profit factor" value={String(stats.pf)}    tone={!Number.isNaN(pfNum) && pfNum >= 1 ? 'positive' : 'neutral'} />
                      <StatTile label="Trades"        value={String(stats.total)} />
                    </div>
                  </section>

                  <section>
                    <h2 className={`${sectionLabel} mb-3`}>Equity</h2>
                    <EquityChart trades={trades} denomination={denomination} />
                  </section>

                  {/* Overview Recent Trades for unauthenticated users */}
                  {!isLoggedIn && (
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className={sectionLabel}>Recent Trades</h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('log')}
                          className="text-xs font-semibold text-violet-600 dark:text-emerald-400 hover:underline"
                        >
                          View all {trades.length} trades →
                        </button>
                      </div>
                      
                      {/* Integrated Single Table Card: 3 crisp clear trades at top */}
                      <div className={`${card} overflow-hidden`}>
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
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                              {trades.slice(0, 3).map((t) => (
                                <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition">
                                  <td className={`${tableTd} tabular-nums text-zinc-600 dark:text-zinc-400`}>{t.date}</td>
                                  <td className={tableTd}>{t.symbol || '—'}</td>
                                  <td className={`${tableTd} capitalize`}>{t.direction || '—'}</td>
                                  <td className={tableTd}><span className={tradeResultBadge(t.result)}>{t.result}</span></td>
                                  <td className={`${tableTd} text-right tabular-nums`}>{t.r_value != null ? Number(t.r_value).toFixed(2) : '—'}</td>
                                  <td className={`${tableTd} text-right tabular-nums font-medium ${Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {fmtPnlStrict(t.pnl_usd, denomination)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Compact blurred extension table (4 rows) with GateBanner */}
                        <div className="relative border-t border-zinc-100 dark:border-zinc-800/60 min-h-[170px]">
                          <div
                            aria-hidden="true"
                            className="pointer-events-none select-none overflow-hidden"
                            style={{ filter: 'blur(5px)', opacity: 0.45 }}
                          >
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[640px] border-collapse text-left">
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                  {trades.slice(3, 7).map((t) => (
                                    <tr key={t.id}>
                                      <td className={`${tableTd} tabular-nums text-zinc-600 dark:text-zinc-400`}>{t.date}</td>
                                      <td className={tableTd}>{t.symbol || '—'}</td>
                                      <td className={`${tableTd} capitalize`}>{t.direction || '—'}</td>
                                      <td className={tableTd}><span className={tradeResultBadge(t.result)}>{t.result}</span></td>
                                      <td className={`${tableTd} text-right tabular-nums`}>{t.r_value != null ? Number(t.r_value).toFixed(2) : '—'}</td>
                                      <td className={`${tableTd} text-right tabular-nums font-medium ${Number(t.pnl_usd) >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {fmtPnlStrict(t.pnl_usd, denomination)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Theme overlay */}
                          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-white/30 to-white/90 dark:via-zinc-900/30 dark:to-zinc-900/90" />

                          {/* Gate Banner */}
                          <GateBanner feature="trade log" tradeCount={tradeCount} ownerName={owner.display_name} />
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* ── CALENDAR TAB ── */}
              {activeTab === 'calendar' && (
                isLoggedIn
                  ? <PublicCalendar trades={trades} denomination={denomination} />
                  : (
                    <GatedCalendarSection ownerName={owner.display_name}>
                      <PublicCalendar trades={trades} denomination={denomination} />
                    </GatedCalendarSection>
                  )
              )}

              {/* ── TRADE LOG TAB ── */}
              {activeTab === 'log' && (
                <TradeLogView
                  trades={trades}
                  denomination={denomination}
                  isLoggedIn={isLoggedIn}
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                  pageSafe={pageSafe}
                  pageStart={pageStart}
                  pageTrades={pageTrades}
                  tradeCount={tradeCount}
                  tradesCapped={tradesCapped}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
