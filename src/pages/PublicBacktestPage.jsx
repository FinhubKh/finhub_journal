import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchSharedBacktest } from '../api/backtests';
import { fmtPnlStrict, fmtDateShort } from '../lib/format';
import { bucketDailyByMonth, EMPTY_YEAR_BUCKETS, yearsFromDates } from '../lib/calendarCells';
import { dailyRowsForCalendar } from '../lib/mt5BacktestParse';
import {
  btnSm,
  card,
  pillBtn,
  pillToggle,
} from '../lib/ui';
import {
  YearView,
  MonthDetailView,
} from '../components/calendar/CalendarViews';
import BreakdownCard from '../components/dashboard/BreakdownCard';
import HeatmapView from '../components/calendar/HeatmapView';
import EquityChart from '../components/dashboard/EquityChart';
import WinRateGauge from '../components/dashboard/WinRateGauge';
import RiskCard from '../components/dashboard/RiskCard';
import HighlightsCard from '../components/dashboard/HighlightsCard';
import ContributionHeatmap from '../components/dashboard/ContributionHeatmap';
import { BrandLogo } from '../components/BrandLogo';
import YearDropdown from '../components/common/YearDropdown';

const EMPTY_OVERRIDE = {};

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

function formatPf(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n > 999) return '∞';
  return n.toFixed(2);
}

export default function PublicBacktestPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState('overview');
  const [year, setYear] = useState(new Date().getFullYear());
  const [screen, setScreen] = useState('year');
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    async function load() {
      try {
        const d = await fetchSharedBacktest(token);
        setData(d);
        if (d.daily?.length > 0) {
          const first = new Date(d.daily[0].date).getFullYear();
          const last = new Date(d.daily[d.daily.length - 1].date).getFullYear();
          const current = new Date().getFullYear();
          if (current >= first && current <= last) setYear(current);
          else setYear(last);
        }
      } catch (err) {
        setError(err.message || 'Could not load shared strategy.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const overview = useMemo(() => {
    if (!data?.backtest) return null;
    const base = data.backtest;
    let bd = { symbol: [], session: [] };
    if (base.source_html) {
      try {
        const parsed = JSON.parse(base.source_html);
        if (parsed.symbol || parsed.session) bd = parsed;
      } catch {
        // ignore
      }
    }
    return { ...base, breakdown: bd };
  }, [data?.backtest]);
  const calendarDaily = useMemo(() => dailyRowsForCalendar(data?.daily), [data?.daily]);
  const uiCurrency = overview?.currency === 'cent' ? 'cent' : 'usd';
  const wins = Number(overview?.wins) || 0;
  const losses = Number(overview?.losses) || 0;
  const tradeCount = Number(overview?.trade_count) || 0;
  const totalPnl = Number(overview?.total_pnl) || 0;
  const wr = tradeCount > 0 ? Math.round((wins / tradeCount) * 100) : 0;

  const availableYears = useMemo(() => yearsFromDates(calendarDaily), [calendarDaily]);
  const minYear = availableYears.length ? availableYears[0] : year;
  const maxYear = availableYears.length ? availableYears[availableYears.length - 1] : year;

  const yearDays = useMemo(() => {
    if (loading || !calendarDaily.length) return EMPTY_YEAR_BUCKETS;
    return bucketDailyByMonth(calendarDaily, year);
  }, [calendarDaily, year, loading]);

  const monthDays = yearDays[month] || [];

  const breakdown = overview?.breakdown || { symbol: [], session: [] };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'calendar', label: 'Calendar' },
  ];

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-zinc-700 dark:border-t-emerald-400"
            aria-hidden
          />
          <p className="text-sm font-medium text-zinc-500">Loading strategy…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-zinc-50 px-4 text-center dark:bg-zinc-950">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Link Unavailable</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{error || 'Strategy not found or no longer public.'}</p>
        <Link to="/" className={`${btnSm} mt-6`}>Go to FinhubKH</Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="shrink-0 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" showWordmark={false} />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Shared strategy
              </div>
              <h1 className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {overview.name}
              </h1>
            </div>
          </div>
          <Link
            to="/"
            className="shrink-0 text-xs font-semibold text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Create your own
          </Link>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {overview.name}
            </h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {overview.report_symbol || overview.symbol ? `${overview.report_symbol || overview.symbol} · ` : ''}
              {overview.range_from && overview.range_to
                ? `${fmtDateShort(overview.range_from)} → ${fmtDateShort(overview.range_to)}`
                : 'Read-only backtest'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="overflow-x-auto" aria-label="Backtest views">
              <div className={`${pillToggle} !flex w-max`} role="tablist">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={view === tab.id}
                    className={`${pillBtn(view === tab.id)} whitespace-nowrap px-4 py-1.5`}
                    onClick={() => setView(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>
            {view === 'calendar' && screen === 'year' && (
              <div className="flex items-center gap-2">
                <YearDropdown value={year} onChange={setYear} minYear={minYear} maxYear={maxYear} />
                {year !== new Date().getFullYear() && (
                  <button className={btnSm} type="button" onClick={() => setYear(new Date().getFullYear())}>
                    Go to {new Date().getFullYear()}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {view === 'overview' && (
            <section
              aria-label="Overview"
              role="tabpanel"
              className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto lg:overflow-hidden"
            >
              <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                <StatTile
                  label="Starting balance"
                  value={fmtPnlStrict(overview?.breakdown?.initialDeposit || 0, uiCurrency)}
                  hint="Initial deposit"
                />
                <StatTile
                  label="Ending balance"
                  value={fmtPnlStrict((overview?.breakdown?.initialDeposit || 0) + (Number(totalPnl) || 0), uiCurrency)}
                  hint="Final account balance"
                />
                <StatTile
                  label="Total PnL"
                  value={fmtPnlStrict(totalPnl, uiCurrency)}
                  hint={`${wins}W · ${losses}L`}
                  tone={totalPnl >= 0 ? 'positive' : 'negative'}
                />
                <StatTile
                  label="Profit factor"
                  value={formatPf(overview.profit_factor)}
                  hint="Gross wins ÷ gross losses"
                  tone={Number(overview.profit_factor) >= 1 ? 'positive' : 'negative'}
                />
                <StatTile
                  label="Win rate"
                  value={`${wr}%`}
                  hint={`${tradeCount} closed`}
                  tone={wr >= 50 ? 'positive' : 'negative'}
                />
                <StatTile
                  label="Trades"
                  value={tradeCount || '—'}
                  hint={`${calendarDaily.length} trading days`}
                />
                <StatTile
                  label="Currency"
                  value={uiCurrency.toUpperCase()}
                  hint={overview?.symbol || 'Strategy tester'}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col gap-3 lg:min-h-0">
                  <div className="min-h-[240px] flex-1 lg:min-h-0">
                    <EquityChart 
                      daily={calendarDaily} 
                      denomination={uiCurrency} 
                      initialDeposit={overview?.breakdown?.initialDeposit || 0} 
                      fill 
                    />
                  </div>
                  <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
                    <RiskCard overview={overview} daily={calendarDaily} denomination={uiCurrency} />
                    <HighlightsCard overview={overview} daily={calendarDaily} denomination={uiCurrency} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-3 lg:h-full lg:w-[min(22rem,38%)]">
                  <div className="shrink-0">
                    <WinRateGauge wins={wins} losses={losses} fill />
                  </div>
                  <div className="min-h-0 flex-1">
                    <BreakdownCard breakdown={breakdown} denomination={uiCurrency} fill />
                  </div>
                </div>
              </div>
            </section>
          )}

          {view === 'heatmap' && (
            <section aria-label="Heatmap" role="tabpanel" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
              <HeatmapView daily={calendarDaily} denomination={uiCurrency} fill />
            </section>
          )}

          {view === 'calendar' && (
            <section aria-label="Calendar" role="tabpanel" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
              {screen === 'year' ? (
                <YearView
                  year={year}
                  yearDays={yearDays}
                  overrideMap={EMPTY_OVERRIDE}
                  useOverrides={false}
                  denomination={uiCurrency}
                  loading={loading}
                  onYearChange={setYear}
                  onSelectMonth={(m) => { setMonth(m); setScreen('detail'); }}
                  hint="Select a month to view daily backtest PnL"
                  showManualLegend={false}
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
                  overrideMap={EMPTY_OVERRIDE}
                  useOverrides={false}
                  denomination={uiCurrency}
                  loading={loading}
                  onBack={() => setScreen('year')}
                  onPrevMonth={() => {
                    setMonth((m) => {
                      if (m === 1) { setYear((y) => y - 1); return 12; }
                      return m - 1;
                    });
                  }}
                  onNextMonth={() => {
                    setMonth((m) => {
                      if (m === 12) { setYear((y) => y + 1); return 1; }
                      return m + 1;
                    });
                  }}
                  showManualLegend={false}
                  fill
                />
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
