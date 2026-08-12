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
const PREVIEW_ROWS = 3;

/* --- Tabs ---------------------------------------------------------- */
const TABS = [
  { id: 'overview', label: 'Overview', gated: false },
  { id: 'calendar', label: 'Calendar', gated: true },
  { id: 'log',      label: 'Trade Log', gated: true },
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
function TabBar({ active, onSelect, isLoggedIn }) {
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
                ? 'border-b-2 border-violet-600 dark:border-emerald-400 text-violet-700 dark:text-emerald-300'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
            {tab.gated && !isLoggedIn && (
              <span className="text-[10px] leading-none text-zinc-400 dark:text-zinc-600">🔒</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/*
 * FloatingGateCard
 * ─────────────────
 * The premium dark card that floats centered and fixed over the blurred
 * gated content. No dark backdrop — the blurred content underneath acts
 * as the visual context. Not dismissible (user must sign up or sign in).
 */
function FloatingGateCard({ feature }) {
  return (
    /* Fixed layer — pointer events pass through the wrapper, only the card itself is interactive */
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4">
      <div
        className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Violet gradient top line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
        {/* Soft violet glow behind card top */}
        <div className="absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-violet-600/15 blur-3xl" />

        <div className="px-8 pb-8 pt-10 text-center">
          {/* Lock icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15 text-2xl ring-1 ring-violet-500/30">
            🔒
          </div>

          {/* Headline */}
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">
            Unlock the Full Trader Journal
          </h2>

          {/* Sub-copy */}
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Create a free account to explore the complete{' '}
            <span className="font-medium text-zinc-200">{feature}</span>,
            track your own trades, and build your trading journal.
          </p>

          {/* Perks list */}
          <ul className="my-6 space-y-2 text-left">
            {[
              'Daily P&L calendar with heat-map view',
              'Full trade history & performance stats',
              'Equity curve, win rate & profit factor',
              'AI coaching & trade analytics',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-300">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-[10px] text-violet-400">✓</span>
                {item}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <Link
              to="/login?mode=signup"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 active:scale-[0.98]"
            >
              Create Free Account →
            </Link>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100 active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>

          <p className="mt-4 text-xs text-zinc-600">Free forever · No credit card required</p>
        </div>
      </div>
    </div>
  );
}

/* --- Gated section wrapper ----------------------------------------- */
/*
 * Wraps any tab's content in a blur when the user is logged out.
 * The blurred content acts as visual context / FOMO behind the card.
 */
function GatedSection({ feature, children }) {
  return (
    <>
      {/* Blurred content underneath */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{ filter: 'blur(7px)', opacity: 0.5 }}
      >
        {children}
      </div>

      {/* Centered floating card (no backdrop) */}
      <FloatingGateCard feature={feature} />
    </>
  );
}

/* --- Trade log (3 preview + blur + card for logged-out) ------------ */
function GatedTradeLog({ trades, denomination, isLoggedIn, page, setPage, totalPages, pageSafe, pageStart, pageTrades, tradeCount, tradesCapped }) {
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

  /* Logged-out: show 3 real rows then blur the rest */
  const previewTrades = trades.slice(0, PREVIEW_ROWS);
  const remaining = trades.slice(PREVIEW_ROWS);
  const hasMore = remaining.length > 0;

  const tableHeader = (
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
  );

  const tradeRow = (t) => (
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
  );

  return (
    <GatedSection feature="trade log">
      <div className={`${card} overflow-hidden`}>
        <div className={cardHd}>
          <h2 className={cardTitle}>Trade History</h2>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{trades.length} trades</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            {tableHeader}
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {previewTrades.map(tradeRow)}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <div className="overflow-hidden" style={{ maxHeight: 160 }}>
            <table className="w-full min-w-[640px] border-collapse text-left">
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {remaining.slice(0, 5).map(tradeRow)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GatedSection>
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

  /* Tab selection: gated tabs always open (showing blurred content + card) */
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

            {/* Tab bar */}
            <TabBar active={activeTab} onSelect={handleTabSelect} isLoggedIn={isLoggedIn} />

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

                  {/* Recent trades teaser (3 rows for logged-out) */}
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
                              {trades.slice(0, PREVIEW_ROWS).map((t) => (
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
                        <div className="flex items-center justify-center border-t border-zinc-100 dark:border-zinc-800 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setActiveTab('log')}
                            className="text-sm font-semibold text-violet-600 dark:text-emerald-400 hover:underline"
                          >
                            🔒 Unlock all {trades.length} trades — it's free
                          </button>
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
                    <GatedSection feature="calendar">
                      <PublicCalendar trades={trades} denomination={denomination} />
                    </GatedSection>
                  )
              )}

              {/* ── TRADE LOG TAB ── */}
              {activeTab === 'log' && (
                <GatedTradeLog
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
