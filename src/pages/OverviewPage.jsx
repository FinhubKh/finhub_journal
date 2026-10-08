import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { fetchDailyPnlByYear } from '../api';
import { viewPnlDenomination, platformShort } from '../lib/accounts';
import { fmtPnlStrict, fmtBalance } from '../lib/format';
import { overridesToMap } from '../lib/dailyPnl';
import {
  btnGhost, btnOutline, card, dashboardPageWideFull,
} from '../lib/ui';
import AccountViewDropdown from '../components/layout/AccountViewDropdown';
import EquityChart from '../components/dashboard/EquityChart';
import BreakdownCard from '../components/dashboard/BreakdownCard';
import PortfolioBreakdown from '../components/dashboard/PortfolioBreakdown';
import WinRateGauge from '../components/dashboard/WinRateGauge';
import RiskCard from '../components/dashboard/RiskCard';
import HighlightsCard from '../components/dashboard/HighlightsCard';
import SiacSummaryCard from '../components/dashboard/SiacSummaryCard';
import { YearView, MonthDetailView } from '../components/calendar/CalendarViews';
import DailyPnlModal from '../components/modals/DailyPnlModal';
import SyncNowButton from '../components/common/SyncNowButton';
import RiskStatusPill from '../components/common/RiskStatusPill';
import YearDropdown from '../components/common/YearDropdown';
import RiskEligibilityPanel from '../components/settings/RiskEligibilityPanel';
import SiacLogo from '../components/common/SiacLogo';
import { startingEquityFromStats } from '../lib/equityChart';
import { bucketDailyByMonth, EMPTY_YEAR_BUCKETS, yearsFromDates } from '../lib/calendarCells';
import { fetchTradeExtremes } from '../api/journal';

function StatTile({ label, value, hint, tone = 'neutral' }) {
  const valueCls =
    tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
        : 'text-zinc-900 dark:text-zinc-100';
  const accent =
    tone === 'positive' ? 'bg-emerald-500'
      : tone === 'negative' ? 'bg-rose-500'
        : 'bg-zinc-300 dark:bg-zinc-600';

  return (
    <div className={`${card} relative flex h-full min-h-0 flex-col justify-between overflow-hidden p-3 sm:p-3.5`}>
      <span className={`absolute inset-y-0 left-0 w-0.5 ${accent}`} aria-hidden />
      <span className="pl-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <div className={`mt-1.5 truncate pl-1.5 text-base font-semibold tracking-tight tabular-nums sm:text-lg ${valueCls}`}>
        {value}
      </div>
      {hint ? (
        <span className="mt-1 truncate pl-1.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          {hint}
        </span>
      ) : null}
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
  const showSiac = viewMode === 'account' && Boolean(activeAccount);
  const isAccount = viewMode === 'account' && Boolean(activeAccount);
  const subtitle = isAccount
    ? [activeAccount.broker, platformShort(activeAccount.platform)].filter(Boolean).join(' · ') || 'Single account'
    : 'Combined performance across all accounts';

  return (
    <header className="mb-4 shrink-0 border-b border-zinc-200/70 pb-4 dark:border-zinc-800/80">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            Dashboard
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Overview
            </h1>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                isAccount
                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {isAccount ? activeAccount.name : 'Portfolio'}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>

        <div
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
          role="toolbar"
          aria-label="Overview actions"
        >
          <div className="w-full min-w-0 sm:w-56">
            <AccountViewDropdown variant="toolbar" />
          </div>
          {showSiac ? (
            <RiskStatusPill variant="toolbar" onClick={onOpenEligibility} />
          ) : null}
          <SyncNowButton variant="toolbar" />
        </div>
      </div>
    </header>
  );
}

function OverviewCalendarSection({
  daily,
  denomination,
  viewMode,
  dataLoading,
  onRefresh,
  sectionTabs,
  activeSection,
  onSectionChange,
}) {
  const useOverrides = viewMode === 'portfolio';
  const availableYears = useMemo(() => yearsFromDates(daily), [daily]);
  const now = new Date();
  const currentYear = now.getFullYear();
  const [screen, setScreen] = useState('year');
  const [year, setYear] = useState(() => availableYears[availableYears.length - 1] || now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dailyOverrides, setDailyOverrides] = useState({});
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [editDay, setEditDay] = useState(null);

  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(year)) {
      setYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, year]);

  const yearDays = useMemo(
    () => (dataLoading ? EMPTY_YEAR_BUCKETS : bucketDailyByMonth(daily, year)),
    [daily, year, dataLoading],
  );
  const monthDays = yearDays[month] || [];

  useEffect(() => {
    if (!useOverrides) {
      setDailyOverrides({});
      setLoadingOverrides(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingOverrides(true);
    (async () => {
      try {
        const rows = await fetchDailyPnlByYear(year);
        if (!cancelled) setDailyOverrides(overridesToMap(rows));
      } catch {
        if (!cancelled) setDailyOverrides({});
      } finally {
        if (!cancelled) setLoadingOverrides(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [year, useOverrides]);

  const loading = dataLoading || (useOverrides && loadingOverrides);
  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  async function handleDailySaved() {
    if (useOverrides) {
      try {
        const rows = await fetchDailyPnlByYear(year);
        setDailyOverrides(overridesToMap(rows));
      } catch {
        setDailyOverrides({});
      }
    }
    await onRefresh?.();
  }

  const yearControls = screen === 'year' ? (
    <>
      {year !== currentYear ? (
        <button className={btnGhost} type="button" onClick={() => setYear(currentYear)}>
          Go to {currentYear}
        </button>
      ) : null}
      <YearDropdown value={year} onChange={setYear} minYear={minYear} maxYear={maxYear} />
    </>
  ) : null;

  return (
    <section aria-label="Calendar" role="tabpanel" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <OverviewSectionNav
        tabs={sectionTabs}
        activeId={activeSection}
        onChange={onSectionChange}
        trailing={yearControls}
      />

      {screen === 'year' ? (
        <YearView
          year={year}
          yearDays={yearDays}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
          denomination={denomination}
          loading={loading}
          onYearChange={setYear}
          onSelectMonth={(m) => {
            setMonth(m);
            setScreen('detail');
          }}
          hint=""
          showManualLegend={useOverrides}
          minYear={minYear}
          maxYear={maxYear}
          fill
          hideHeader
        />
      ) : (
        <MonthDetailView
          year={year}
          month={month}
          monthDays={monthDays}
          overrideMap={dailyOverrides}
          useOverrides={useOverrides}
          denomination={denomination}
          loading={loading}
          onBack={() => setScreen('year')}
          onPrevMonth={() => {
            setMonth((m) => {
              if (m === 1) {
                setYear((y) => y - 1);
                return 12;
              }
              return m - 1;
            });
          }}
          onNextMonth={() => {
            setMonth((m) => {
              if (m === 12) {
                setYear((y) => y + 1);
                return 1;
              }
              return m + 1;
            });
          }}
          onEditDay={useOverrides ? (date, row, override) => setEditDay({
            date,
            tradesSum: Number(row?.pnl) || 0,
            tradeCount: Number(row?.trades) || 0,
            override,
          }) : undefined}
          showManualLegend={useOverrides}
          fill
        />
      )}

      {editDay && (
        <DailyPnlModal
          date={editDay.date}
          tradesSum={editDay.tradesSum}
          tradeCount={editDay.tradeCount}
          override={editDay.override}
          denomination={denomination}
          onClose={() => setEditDay(null)}
          onSaved={handleDailySaved}
        />
      )}
    </section>
  );
}

function EligibilitySection({ account, daily, maxDd, onChanged }) {
  if (!account) {
    return (
      <div className={`${card} flex h-full min-h-0 items-center justify-center px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400`}>
        Switch to a single account to check Master / EA eligibility.
      </div>
    );
  }

  return (
    <section
      aria-labelledby="overview-eligibility-heading"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
    >
      <div className={`${card} flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-4 md:px-5`}>
        <RiskEligibilityPanel
          account={account}
          trades={[]}
          daily={daily}
          maxDd={maxDd}
          onChanged={onChanged}
          fill
          header={(
            <>
              <SiacLogo size={40} className="mt-0.5" />
              <div className="min-w-0">
                <h2
                  id="overview-eligibility-heading"
                  className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
                >
                  SIAC Eligibility
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Auto-checked from this account&apos;s journal history. Capital protection first.
                </p>
              </div>
            </>
          )}
        />
      </div>
    </section>
  );
}

function OverviewSectionNav({ tabs, activeId, onChange, trailing = null }) {
  return (
    <nav
      className="mb-3 shrink-0 border-b border-zinc-200/70 dark:border-zinc-800/80"
      aria-label="Overview sections"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="-mb-px flex min-w-0 flex-1 gap-0.5 overflow-x-auto" role="tablist">
          {tabs.map((tab) => {
            const active = activeId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
                onClick={() => onChange(tab.id)}
              >
                {tab.label}
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition ${
                    active ? 'bg-violet-600 dark:bg-violet-400' : 'bg-transparent'
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
        {trailing ? (
          <div className="relative z-40 mb-px flex shrink-0 items-center gap-2 self-center pb-1">
            {trailing}
          </div>
        ) : null}
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

function EmptyOverview({ onOpenAccounts }) {
  return (
    <div className={`${card} flex flex-col items-center justify-center border-dashed px-6 py-14 text-center`}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l3.75-7.5 3.75 4.5L15 6l6 7.5M3 18h18" />
        </svg>
      </div>
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">No trades in this view yet</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        Connect MetaTrader from Accounts, or switch accounts in the sidebar.
      </p>
      <button className={`${btnOutline} mt-6`} type="button" onClick={onOpenAccounts}>
        Open Accounts
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
  tradingAccounts,
  onSelectAccount,
  onSiacChanged,
}) {
  const isAccountView = viewMode === 'account' && Boolean(activeAccount);
  const totalPnl = Number(stats?.totalPnl) || 0;
  const deposits = Number(stats?.deposits) || 0;
  const withdrawals = Number(stats?.withdrawals) || 0;
  // Capital base for DD% / risk tiles: money put in — never negative net cashflow.
  const capitalBase = (isAccountView ? Number(activeAccount?.starting_balance) || 0 : 0)
    || deposits
    || startingEquityFromStats(stats);
  // Equity curve starts at 0 so it shows cumulative trade PnL.
  // Using net cashflow (balance − totalPnl) as Start warps the chart to −$hundreds of k after withdrawals.
  const equityStart = 0;
  const currentBalance = stats?.balance != null
    ? Number(stats.balance)
    : capitalBase + totalPnl;
  const trades = Number(stats?.total) || 0;
  const wins = Number(stats?.wins) || 0;
  const losses = Number(stats?.losses) || 0;
  const wr = Number(stats?.wr) || 0;
  const pf = stats?.pf;
  const pfInfinite = pf === '∞';
  const pfNum = parseFloat(pf);
  const pfPositive = !Number.isNaN(pfNum) && (pfNum >= 1 || pfInfinite);

  const trueMaxDd = Number(stats?.maxDD) || 0;
  const trueMaxDdPercent = capitalBase > 0 && trueMaxDd > 0
    ? Number(((trueMaxDd / capitalBase) * 100).toFixed(1))
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
      direction: breakdown?.direction || [],
      outcome: breakdown?.outcome || [],
      initialDeposit: capitalBase,
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
    capitalBase,
  ]);

  return (
    <section
      aria-label="Overview"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col gap-2 overflow-y-auto lg:overflow-hidden"
    >
      <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
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
          value={fmtBalance(deposits || (withdrawals > 0 ? 0 : capitalBase), denomination)}
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

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="min-h-[11rem] flex-[1.25] sm:min-h-[13rem] lg:min-h-0">
            <EquityChart
              daily={daily}
              denomination={denomination}
              initialDeposit={equityStart}
              fill
            />
          </div>

          <div className="grid shrink-0 grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            <div className="h-full min-h-[16rem]">
              <RiskCard overview={overview} daily={daily} denomination={denomination} fill />
            </div>
            <div className="h-full min-h-[16rem]">
              <HighlightsCard overview={overview} daily={daily} denomination={denomination} fill />
            </div>
            <div className="h-full md:col-span-2 xl:col-span-1">
              <SiacSummaryCard
                account={isAccountView ? activeAccount : null}
                accounts={isAccountView ? undefined : tradingAccounts}
                onSelectAccount={onSelectAccount}
                onChanged={onSiacChanged}
                fill
              />
            </div>
          </div>
        </div>

        <div className="flex w-full min-h-0 shrink-0 flex-col gap-2 lg:h-full lg:w-[min(20rem,30%)]">
          <div className="shrink-0">
            <WinRateGauge wins={wins} losses={losses} fill />
          </div>
          <div className="min-h-[16rem] flex-1 lg:min-h-0">
            <BreakdownCard
              breakdown={breakdown || { symbol: [], session: [], direction: [], outcome: [] }}
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
    refreshTrades,
    setActiveAccountId,
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
      { id: 'heatmap', label: 'Calendar' },
    ];
    if (showEligibility) {
      next.push({ id: 'eligibility', label: 'SIAC' });
    }
    if (showAccounts) {
      next.push({ id: 'accounts', label: 'Accounts' });
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
              <EmptyOverview onOpenAccounts={() => navigate('/dashboard/accounts')} />
            </div>
          )}

          {(hasActivity || tradingAccounts.length > 0) && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {activeSection === 'heatmap' && hasActivity ? (
                <OverviewCalendarSection
                  daily={journalDaily}
                  denomination={denomination}
                  viewMode={viewMode}
                  dataLoading={dataLoading}
                  onRefresh={refreshTrades}
                  sectionTabs={tabs}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                />
              ) : (
                <>
                  <OverviewSectionNav
                    tabs={tabs}
                    activeId={activeSection}
                    onChange={setActiveSection}
                  />

                  {activeSection === 'overview' && hasActivity && (
                    <StrategyOverviewSection
                      stats={stats}
                      daily={journalDaily}
                      breakdown={journalBreakdown}
                      denomination={denomination}
                      activeAccount={activeAccount}
                      viewMode={viewMode}
                      tradeExtremes={tradeExtremes}
                      tradingAccounts={tradingAccounts}
                      onSelectAccount={(id) => {
                        setActiveAccountId(id);
                        setActiveSection('eligibility');
                      }}
                      onSiacChanged={refreshTradingAccounts}
                    />
                  )}

                  {activeSection === 'overview' && !hasActivity && tradingAccounts.length > 0 && (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <SiacSummaryCard
                        account={showEligibility ? activeAccount : null}
                        accounts={showEligibility ? undefined : tradingAccounts}
                        onSelectAccount={(id) => {
                          setActiveAccountId(id);
                          setActiveSection('eligibility');
                        }}
                        onChanged={refreshTradingAccounts}
                      />
                    </div>
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
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
