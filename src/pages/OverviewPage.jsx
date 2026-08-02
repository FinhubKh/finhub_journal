import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { computeStats } from '../lib/stats';
import { viewPnlDenomination } from '../lib/accounts';
import { fmtPnlStrict } from '../lib/format';
import {
  btnOutline, card, dashboardPageWideFull, pillBtn, pillToggle, sectionLabel,
} from '../lib/ui';
import AccountViewDropdown from '../components/layout/AccountViewDropdown';
import EquityChart from '../components/dashboard/EquityChart';
import BreakdownCard from '../components/dashboard/BreakdownCard';
import PortfolioBreakdown from '../components/dashboard/PortfolioBreakdown';
import LeaderboardPreview from '../components/leaderboard/LeaderboardPreview';
import SyncNowButton from '../components/common/SyncNowButton';

function StatTile({ label, value, hint, tone = 'neutral' }) {
  const valueCls =
    tone === 'positive' ? 'text-violet-600 dark:text-emerald-400'
      : tone === 'negative' ? 'text-rose-600 dark:text-rose-400'
        : 'text-zinc-900 dark:text-zinc-100';

  return (
    <div className={`${card} flex h-full flex-col justify-between p-4`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      <div className={`mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${valueCls}`}>
        {value}
      </div>
      {hint ? <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</span> : null}
    </div>
  );
}

function OverviewHeader() {
  return (
    <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Performance snapshot for your current view.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SyncNowButton />
        <AccountViewDropdown variant="header" />
      </div>
    </header>
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
        Connect MetaTrader 5 from Settings → How to install, or switch accounts in the sidebar.
      </p>
      <button className={`${btnOutline} mt-5`} type="button" onClick={onOpenSetup}>
        Open MT5 setup guide
      </button>
    </div>
  );
}

function SummarySection({ stats, pfPositive, trades, denomination }) {
  return (
    <section
      aria-labelledby="overview-summary-heading"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col gap-4"
    >
      <div className="shrink-0">
        <h2 id="overview-summary-heading" className={`${sectionLabel} mb-3`}>Summary</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Net result"
            value={fmtPnlStrict(stats?.totalPnl, denomination)}
            hint={`${stats?.total || 0} closed trade${stats?.total !== 1 ? 's' : ''}`}
            tone={stats ? (stats.totalPnl >= 0 ? 'positive' : 'negative') : 'neutral'}
          />
          <StatTile
            label="Win rate"
            value={stats ? `${stats.wr}%` : '—'}
            hint={stats ? `${stats.wins.length}W · ${stats.losses.length}L` : undefined}
            tone={stats && stats.wr >= 50 ? 'positive' : stats ? 'negative' : 'neutral'}
          />
          <StatTile
            label="Profit factor"
            value={stats ? stats.pf : '—'}
            hint="Gross wins ÷ gross losses"
            tone={pfPositive ? 'positive' : stats ? 'negative' : 'neutral'}
          />
          <StatTile
            label="Total trades"
            value={stats ? String(stats.total) : '—'}
            hint={stats ? `Avg ${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R per trade` : undefined}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <h2 className={`${sectionLabel} mb-3 shrink-0`}>Equity</h2>
        <div className="min-h-0 flex-1">
          <EquityChart trades={trades} denomination={denomination} fill />
        </div>
      </div>
    </section>
  );
}

function RiskSection({ stats, showAccounts, denomination }) {
  return (
    <section
      aria-labelledby="overview-risk-heading"
      role="tabpanel"
      className="flex h-full min-h-0 w-full flex-col gap-4"
    >
      <div className="shrink-0">
        <h2 id="overview-risk-heading" className={`${sectionLabel} mb-3`}>Risk & expectancy</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            label="Expectancy"
            value={stats && !Number.isNaN(stats.expectancy) ? fmtPnlStrict(stats.expectancy, denomination) : '—'}
            hint="Per trade"
            tone={stats && stats.expectancy >= 0 ? 'positive' : stats ? 'negative' : 'neutral'}
          />
          <StatTile
            label="Avg R"
            value={stats ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}
            hint="Mean R-multiple"
          />
          <StatTile
            label="Max drawdown"
            value={stats && stats.maxDD > 0 ? fmtPnlStrict(-stats.maxDD, denomination) : '—'}
            hint="Peak to trough"
            tone="negative"
          />
          <StatTile
            label="Avg win"
            value={stats && stats.avgWin > 0 ? fmtPnlStrict(stats.avgWin, denomination) : '—'}
            tone="positive"
          />
          <StatTile
            label="Avg loss"
            value={stats && stats.avgLoss > 0 ? fmtPnlStrict(-stats.avgLoss, denomination) : '—'}
            tone="negative"
          />
          <div className={`${card} flex h-full flex-col justify-between p-4`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Streaks
            </span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xl font-bold tabular-nums text-violet-600 dark:text-emerald-400 sm:text-2xl">
                  {stats && stats.bestStreak > 0 ? `${stats.bestStreak}W` : '—'}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Best win</span>
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400 sm:text-2xl">
                  {stats && stats.worstStreak > 0 ? `${stats.worstStreak}L` : '—'}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Worst loss</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAccounts && (
        <div className="flex min-h-0 flex-1 flex-col">
          <h2 className={`${sectionLabel} mb-3 shrink-0`}>Accounts</h2>
          <div className="min-h-0 flex-1">
            <PortfolioBreakdown fill />
          </div>
        </div>
      )}
      {!showAccounts && <div className="min-h-0 flex-1" aria-hidden />}
    </section>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { visibleTrades, viewMode, activeAccount, dataLoading } = useAppData();
  const stats = useMemo(() => computeStats(visibleTrades), [visibleTrades]);
  const denomination = useMemo(() => viewPnlDenomination(viewMode, activeAccount), [viewMode, activeAccount]);
  const hasTrades = visibleTrades.length > 0;
  const showAccounts = viewMode === 'portfolio';

  const tabs = useMemo(
    () => [
      { id: 'summary', label: 'Summary' },
      { id: 'risk', label: showAccounts ? 'Risk & Accounts' : 'Risk' },
      { id: 'breakdown', label: 'Breakdown' },
      { id: 'leaderboard', label: 'Leaderboard' },
    ],
    [showAccounts],
  );

  const [activeSection, setActiveSection] = useState('summary');

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeSection)) {
      setActiveSection('summary');
    }
  }, [tabs, activeSection]);

  const pfNum = stats ? parseFloat(stats.pf) : NaN;
  const pfPositive = !Number.isNaN(pfNum) && (pfNum >= 1 || stats.pf === '∞');

  return (
    <div className={dashboardPageWideFull}>
      <OverviewHeader />

      {dataLoading ? (
        <OverviewLoading />
      ) : (
        <>
          {!hasTrades && (
            <div className="mb-5 shrink-0">
              <EmptyOverview onOpenSetup={() => navigate('/dashboard', { state: { tab: 'setup' } })} />
            </div>
          )}

          {hasTrades && (
            <>
              <OverviewSectionNav
                tabs={tabs}
                activeId={activeSection}
                onChange={setActiveSection}
              />

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {activeSection === 'summary' && (
                  <SummarySection
                    stats={stats}
                    pfPositive={pfPositive}
                    trades={visibleTrades}
                    denomination={denomination}
                  />
                )}

                {activeSection === 'risk' && (
                  <RiskSection stats={stats} showAccounts={showAccounts} denomination={denomination} />
                )}

                {activeSection === 'breakdown' && (
                  <section aria-label="Breakdown" role="tabpanel" className="flex h-full min-h-0 w-full flex-col">
                    <BreakdownCard trades={visibleTrades} denomination={denomination} fill />
                  </section>
                )}

                {activeSection === 'leaderboard' && (
                  <section aria-label="Leaderboard" role="tabpanel" className="flex h-full min-h-0 w-full flex-col">
                    <LeaderboardPreview
                      limit={12}
                      seeAllState={{ tab: 'leaderboard' }}
                      fill
                    />
                  </section>
                )}
              </div>
            </>
          )}

          {!hasTrades && (
            <div className="mt-2 min-h-0 flex-1">
              <LeaderboardPreview
                limit={5}
                seeAllState={{ tab: 'leaderboard' }}
                fill
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
