import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { viewPnlDenomination, platformShort } from '../lib/accounts';
import { fmtPnlStrict, fmtBalance } from '../lib/format';
import {
  btnOutline, card, dashboardPageWideFull, pillBtn, pillToggle, sectionLabel,
} from '../lib/ui';
import AccountViewDropdown from '../components/layout/AccountViewDropdown';
import EquityChart from '../components/dashboard/EquityChart';
import BreakdownCard from '../components/dashboard/BreakdownCard';
import PortfolioBreakdown from '../components/dashboard/PortfolioBreakdown';
import WinRateGauge from '../components/dashboard/WinRateGauge';
import RiskCard from '../components/dashboard/RiskCard';
import HighlightsCard from '../components/dashboard/HighlightsCard';
import HeatmapView from '../components/calendar/HeatmapView';
import SyncNowButton from '../components/common/SyncNowButton';
import RiskStatusPill from '../components/common/RiskStatusPill';
import RiskEligibilityPanel from '../components/settings/RiskEligibilityPanel';
import { startingEquityFromStats } from '../lib/equityChart';
import { fetchTradeExtremes } from '../api/journal';

function StatTile({ label, value, hint, tone = 'neutral' }) {
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

function formatPf(value, infinite) {
  if (infinite || value === '∞') return '∞';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toFixed(2);
}

function OverviewHeader({ activeAccount, viewMode, onOpenEligibility }) {
  return (
    <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {viewMode === 'account' && activeAccount
            ? `${activeAccount.name}${activeAccount.broker ? ` · ${activeAccount.broker}` : ''} · ${platformShort(activeAccount.platform)}`
            : 'All accounts · Portfolio view'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RiskStatusPill onClick={onOpenEligibility} />
        <SyncNowButton />
        <AccountViewDropdown variant="header" />
      </div>
    </header>
  );
}

function EligibilitySection({ account, daily, maxDd, onChanged }) {
  if (!account) {
    return (
      <div className={`${card} px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400`}>
        Switch to a single account to check Master / EA eligibility.
      </div>
    );
  }

  return (
    <section
      aria-labelledby="overview-eligibility-heading"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto"
    >
      <div className={`${card} px-4 py-4 md:px-5`}>
        <div className="mb-4 border-b border-zinc-100 pb-3 dark:border-zinc-800">
          <p className={sectionLabel}>Master / EA</p>
          <h2
            id="overview-eligibility-heading"
            className="mt-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            SIAC Eligibility
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Auto-checked from this account&apos;s journal history. Capital protection first.
          </p>
        </div>
        <RiskEligibilityPanel
          account={account}
          trades={[]}
          daily={daily}
          maxDd={maxDd}
          onChanged={onChanged}
        />
      </div>
    </section>
  );
}

function OverviewSectionNav({ tabs, activeId, onChange }) {
  return (
    <nav
      className="mb-4 shrink-0 -mx-1 overflow-x-auto px-1 pb-1"
      aria-label="Overview sections"
    >
      <div className={`${pillToggle} w-max min-w-full sm:min-w-0`} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            className={`${pillBtn(activeId === tab.id)} whitespace-nowrap px-3.5 py-1.5`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80 ${className}`} />;
}

function OverviewLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center space-y-5" aria-busy="true" aria-live="polite">
      <div className="flex flex-col items-center justify-center gap-3 py-4">
        <span
          className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-zinc-700 dark:border-t-emerald-400"
          aria-hidden
        />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Loading your overview…</p>
      </div>
      <SkeletonBlock className="h-10 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>
    </div>
  );
}

function EmptyOverview({ onOpenSetup }) {
  return (
    <div className={`${card} flex flex-col items-center justify-center px-6 py-12 text-center`}>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">No trades in this view yet</p>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        Connect MetaTrader from Settings → How to install, or switch accounts in the sidebar.
      </p>
      <button className={`${btnOutline} mt-5`} type="button" onClick={onOpenSetup}>
        Open MetaTrader setup guide
      </button>
    </div>
  );
}

function StrategyOverviewSection({
  stats,
  daily,
  breakdown,
  denomination,
  activeAccount,
  viewMode,
  tradeExtremes,
}) {
  const isAccountView = viewMode === 'account' && Boolean(activeAccount);
  const totalPnl = Number(stats?.totalPnl) || 0;
  const deposits = Number(stats?.deposits) || 0;
  const withdrawals = Number(stats?.withdrawals) || 0;
  const netDeposits = deposits - withdrawals;
  // Equity chart start = balance − trade PnL (same as net deposits when cashflows are complete).
  const equityStart = startingEquityFromStats(stats)
    || (isAccountView ? Number(activeAccount?.starting_balance) || 0 : 0)
    || netDeposits;
  const currentBalance = stats?.balance != null
    ? Number(stats.balance)
    : equityStart + totalPnl;
  const trades = Number(stats?.total) || 0;
  const wins = Number(stats?.wins) || 0;
  const losses = Number(stats?.losses) || 0;
  const wr = Number(stats?.wr) || 0;
  const pf = stats?.pf;
  const pfInfinite = pf === '∞';
  const pfNum = parseFloat(pf);
  const pfPositive = !Number.isNaN(pfNum) && (pfNum >= 1 || pfInfinite);

  const trueMaxDd = Number(stats?.maxDD) || 0;
  const trueMaxDdPercent = equityStart > 0 && trueMaxDd > 0
    ? Number(((trueMaxDd / equityStart) * 100).toFixed(1))
    : 0;
  const recovery = totalPnl > 0 && trueMaxDd > 0
    ? Number((totalPnl / trueMaxDd).toFixed(2))
    : 0;

  // Annualized Sharpe from daily PnL (only when we have enough trading days).
  let sharpe = null;
  if (daily && daily.length > 1) {
    const pnls = daily.map((d) => Number(d.pnl) || 0);
    const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const variance = pnls.reduce((sum, val) => sum + (val - mean) ** 2, 0) / (pnls.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      sharpe = Number(((mean / stdDev) * Math.sqrt(252)).toFixed(2));
    }
  }

  const overview = useMemo(() => ({
    name: isAccountView ? activeAccount.name : 'Portfolio',
    symbol: isAccountView
      ? (activeAccount.broker || activeAccount.name)
      : 'All Accounts',
    currency: denomination,
    totalPnl,
    tradeCount: trades,
    wins,
    losses,
    beCount: Math.max(0, trades - wins - losses),
    wr,
    profitFactor: pf,
    profitFactorInfinite: pfInfinite,
    maxDD: trueMaxDd,
    bestStreak: Number(stats?.bestStreak) || 0,
    worstStreak: Number(stats?.worstStreak) || 0,
    bestTrade: Number(tradeExtremes?.bestTrade) || 0,
    worstTrade: Number(tradeExtremes?.worstTrade) || 0,
    breakdown: {
      symbol: breakdown?.symbol || [],
      session: breakdown?.session || [],
      initialDeposit: equityStart,
      maxDdAmount: trueMaxDd,
      maxDdPercent: trueMaxDdPercent,
      sharpeRatio: sharpe,
      recoveryFactor: recovery,
      maxTradeProfit: Number(tradeExtremes?.bestTrade) || 0,
      largestLoss: Number(tradeExtremes?.worstTrade) || 0,
      maxConsWins: Number(stats?.bestStreak) || 0,
      maxConsLosses: Number(stats?.worstStreak) || 0,
    },
  }), [
    isAccountView,
    activeAccount,
    denomination,
    totalPnl,
    trades,
    wins,
    losses,
    wr,
    pf,
    pfInfinite,
    trueMaxDd,
    trueMaxDdPercent,
    sharpe,
    recovery,
    stats,
    tradeExtremes,
    breakdown,
    equityStart,
  ]);

  return (
    <section
      aria-label="Overview"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto lg:overflow-hidden"
    >
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        <StatTile
          label="Current balance"
          value={fmtBalance(currentBalance, denomination)}
          hint="Deposits − withdrawals + trade PnL"
        />
        <StatTile
          label="Trade PnL"
          value={fmtPnlStrict(totalPnl, denomination)}
          hint={`${wins}W · ${losses}L closed`}
          tone={totalPnl >= 0 ? 'positive' : 'negative'}
        />
        <StatTile
          label="Deposits"
          value={fmtBalance(deposits || (withdrawals > 0 ? 0 : equityStart), denomination)}
          hint={
            withdrawals > 0
              ? `Withdrawn ${fmtBalance(withdrawals, denomination)}`
              : 'Cash transferred in'
          }
        />
        <StatTile
          label="Profit factor"
          value={formatPf(pf, pfInfinite)}
          hint="Gross wins ÷ gross losses"
          tone={pfPositive ? 'positive' : 'negative'}
        />
        <StatTile
          label="Win rate"
          value={trades > 0 ? `${wr}%` : '—'}
          hint={trades > 0 ? `${trades} closed` : 'No closed trades'}
          tone={trades > 0 ? (wr >= 50 ? 'positive' : 'negative') : 'neutral'}
        />
        <StatTile
          label="Trades"
          value={trades || '—'}
          hint={`${daily?.length || 0} trading days`}
        />
        <StatTile
          label="Currency"
          value={denomination.toUpperCase()}
          hint={isAccountView ? (activeAccount.broker || activeAccount.name) : 'Portfolio (USD)'}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:min-h-0">
          <div className="min-h-[240px] flex-1 lg:min-h-0">
            <EquityChart
              daily={daily}
              denomination={denomination}
              initialDeposit={equityStart}
              fill
            />
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <RiskCard overview={overview} daily={daily} denomination={denomination} />
            <HighlightsCard overview={overview} daily={daily} denomination={denomination} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:h-full lg:w-[min(22rem,38%)]">
          <div className="shrink-0">
            <WinRateGauge wins={wins} losses={losses} fill />
          </div>
          <div className="min-h-0 flex-1">
            <BreakdownCard
              breakdown={breakdown || { symbol: [], session: [] }}
              denomination={denomination}
              fill
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const {
    journalStats: stats,
    journalDaily,
    journalBreakdown,
    viewMode,
    activeAccountId,
    activeAccount,
    tradingAccounts,
    dataLoading,
    refreshTradingAccounts,
    tradesEpoch,
  } = useAppData();

  const denomination = useMemo(() => viewPnlDenomination(viewMode, activeAccount), [viewMode, activeAccount]);
  const hasTrades = (stats?.total || 0) > 0;
  const hasCashflow = (stats?.deposits || 0) > 0 || (stats?.withdrawals || 0) > 0;
  const hasActivity = hasTrades || hasCashflow;
  const showAccounts = viewMode === 'portfolio';
  const showEligibility = viewMode === 'account' && Boolean(activeAccount);

  const [activeSection, setActiveSection] = useState('overview');
  const [tradeExtremes, setTradeExtremes] = useState({ bestTrade: 0, worstTrade: 0 });

  const scopedAccountId = viewMode === 'account' && activeAccountId ? activeAccountId : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const extremes = await fetchTradeExtremes(scopedAccountId, { accounts: tradingAccounts });
        if (!cancelled) setTradeExtremes(extremes);
      } catch {
        if (!cancelled) setTradeExtremes({ bestTrade: 0, worstTrade: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopedAccountId, tradesEpoch, tradingAccounts]);

  const tabs = useMemo(() => {
    const next = [
      { id: 'overview', label: 'Overview' },
      { id: 'heatmap', label: 'Heatmap' },
    ];
    if (showAccounts) {
      next.push({ id: 'accounts', label: 'Accounts' });
    }
    if (showEligibility) {
      next.push({ id: 'eligibility', label: 'SIAC Eligibility' });
    }
    return next;
  }, [showAccounts, showEligibility]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeSection)) {
      setActiveSection('overview');
    }
  }, [tabs, activeSection]);

  return (
    <div className={dashboardPageWideFull}>
      <OverviewHeader
        activeAccount={activeAccount}
        viewMode={viewMode}
        onOpenEligibility={() => setActiveSection('eligibility')}
      />

      {dataLoading ? (
        <OverviewLoading />
      ) : (
        <>
          {!hasActivity && (
            <div className="mb-5 shrink-0">
              <EmptyOverview onOpenSetup={() => navigate('/dashboard', { state: { tab: 'setup' } })} />
            </div>
          )}

          {(hasActivity || showEligibility) && (
            <>
              <OverviewSectionNav
                tabs={tabs}
                activeId={activeSection}
                onChange={setActiveSection}
              />

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {activeSection === 'overview' && hasActivity && (
                  <StrategyOverviewSection
                    stats={stats}
                    daily={journalDaily}
                    breakdown={journalBreakdown}
                    denomination={denomination}
                    activeAccount={activeAccount}
                    viewMode={viewMode}
                    tradeExtremes={tradeExtremes}
                  />
                )}

                {activeSection === 'heatmap' && hasActivity && (
                  <section aria-label="Heatmap" role="tabpanel" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    <HeatmapView daily={journalDaily} denomination={denomination} fill />
                  </section>
                )}

                {activeSection === 'accounts' && showAccounts && (
                  <section aria-label="Accounts" role="tabpanel" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    <PortfolioBreakdown fill />
                  </section>
                )}

                {activeSection === 'eligibility' && showEligibility && (
                  <EligibilitySection
                    account={activeAccount}
                    daily={journalDaily}
                    maxDd={stats?.maxDD || 0}
                    onChanged={refreshTradingAccounts}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
