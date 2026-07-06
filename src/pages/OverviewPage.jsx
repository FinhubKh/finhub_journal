import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { computeStats } from '../lib/stats';
import { btnOutline, card, dashboardPageWide, sectionLabel } from '../lib/ui';
import AccountViewDropdown from '../components/AccountViewDropdown';
import EquityChart from '../components/tabs/EquityChart';
import BreakdownCard from '../components/tabs/BreakdownCard';
import PortfolioBreakdown from '../components/PortfolioBreakdown';

function fmtPnl(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

function StatTile({ label, value, hint, tone = 'neutral', className = '' }) {
  const valueCls =
    tone === 'positive' ? 'text-violet-600'
      : tone === 'negative' ? 'text-rose-600'
        : 'text-zinc-900';

  return (
    <div className={`${card} flex flex-col justify-between p-4 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <div className={`mt-2 text-xl font-bold tracking-tight sm:text-2xl ${valueCls}`}>{value}</div>
      {hint ? <span className="mt-1 text-xs text-zinc-500">{hint}</span> : null}
    </div>
  );
}

function HeroStat({ label, value, hint, positive }) {
  return (
    <div className={`${card} relative overflow-hidden p-5 sm:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-transparent" />
      <div className="relative">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
        <div className={`mt-2 text-3xl font-bold tracking-tight sm:text-4xl ${positive == null ? 'text-zinc-900' : positive ? 'text-violet-600' : 'text-rose-600'}`}>
          {value}
        </div>
        {hint ? <p className="mt-2 text-sm text-zinc-500">{hint}</p> : null}
      </div>
    </div>
  );
}

function OverviewHeader() {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">Performance snapshot for your current view.</p>
      </div>
      <AccountViewDropdown variant="header" />
    </header>
  );
}

function EmptyOverview({ onOpenSetup }) {
  return (
    <div className={`${card} flex flex-col items-center justify-center px-6 py-12 text-center`}>
      <p className="text-sm font-semibold text-zinc-800">No trades in this view yet</p>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Connect MetaTrader 5 from the MT5 Setup section, or switch accounts in the sidebar.
      </p>
      <button className={`${btnOutline} mt-5`} type="button" onClick={onOpenSetup}>
        Open MT5 setup guide
      </button>
    </div>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { visibleTrades, viewMode } = useAppData();
  const stats = computeStats(visibleTrades);
  const hasTrades = visibleTrades.length > 0;

  const pfNum = stats ? parseFloat(stats.pf) : NaN;
  const pfPositive = !Number.isNaN(pfNum) && (pfNum >= 1 || stats.pf === '∞');

  return (
    <div className={dashboardPageWide}>
      <OverviewHeader />

      {!hasTrades && (
        <div className="mb-6">
          <EmptyOverview onOpenSetup={() => navigate('/dashboard', { state: { tab: 'setup' } })} />
        </div>
      )}

      {hasTrades && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <section aria-label="Key metrics">
            <h2 className={`${sectionLabel} mb-3`}>Summary</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroStat
                label="Net result"
                value={fmtPnl(stats?.totalPnl)}
                hint={`${stats?.total || 0} closed trade${stats?.total !== 1 ? 's' : ''}`}
                positive={stats ? stats.totalPnl >= 0 : null}
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
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-6">
              {/* Risk & expectancy */}
              <section aria-label="Risk metrics">
                <h2 className={`${sectionLabel} mb-3`}>Risk & expectancy</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatTile
                    label="Expectancy"
                    value={stats && !Number.isNaN(stats.expectancy) ? fmtPnl(stats.expectancy) : '—'}
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
                    value={stats && stats.maxDD > 0 ? fmtPnl(-stats.maxDD) : '—'}
                    hint="Peak to trough"
                    tone="negative"
                  />
                  <StatTile
                    label="Avg win"
                    value={stats && stats.avgWin > 0 ? fmtPnl(stats.avgWin) : '—'}
                    tone="positive"
                  />
                  <StatTile
                    label="Avg loss"
                    value={stats && stats.avgLoss > 0 ? fmtPnl(-stats.avgLoss) : '—'}
                    tone="negative"
                  />
                  <div className={`${card} p-4`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Streaks</span>
                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xl font-bold text-violet-600 sm:text-2xl">
                          {stats && stats.bestStreak > 0 ? `${stats.bestStreak}W` : '—'}
                        </div>
                        <span className="text-xs text-zinc-500">Best win</span>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-rose-600 sm:text-2xl">
                          {stats && stats.worstStreak > 0 ? `${stats.worstStreak}L` : '—'}
                        </div>
                        <span className="text-xs text-zinc-500">Worst loss</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <EquityChart trades={visibleTrades} />
              <div className="xl:hidden">
                <BreakdownCard trades={visibleTrades} />
              </div>
            </div>

            <aside className="min-w-0 space-y-4">
              {viewMode === 'portfolio' && <PortfolioBreakdown />}
              <div className="hidden xl:block">
                <BreakdownCard trades={visibleTrades} />
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
