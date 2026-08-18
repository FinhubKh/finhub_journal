import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchSharedBacktest } from '../api/backtests';
import { fmtPnlStrict } from '../lib/format';
import { bucketDailyByMonth, EMPTY_YEAR_BUCKETS, yearsFromDates } from '../lib/calendarCells';
import {
  card,
  pageShell,
  pillBtn,
  pillToggle,
  btnSm,
} from '../lib/ui';
import {
  YearView,
  MonthDetailView,
  CalendarStatCard,
} from '../components/calendar/CalendarViews';
import BreakdownCard from '../components/dashboard/BreakdownCard';
import HeatmapView from '../components/calendar/HeatmapView';
import EquityChart from '../components/dashboard/EquityChart';
import WinRateGauge from '../components/dashboard/WinRateGauge';

const EMPTY_OVERRIDE = {};

export default function PublicBacktestPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [view, setView] = useState('overview'); // overview, heatmap, calendar
  const [year, setYear] = useState(new Date().getFullYear());
  const [screen, setScreen] = useState('year'); // year, detail
  const [month, setMonth] = useState(1);

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

  const overview = data?.backtest;
  const calendarDaily = data?.daily || [];

  const uiCurrency = overview?.currency === 'cent' ? 'cent' : 'usd';

  // Compute years
  const availableYears = useMemo(() => yearsFromDates(calendarDaily), [calendarDaily]);
  const minYear = availableYears.length ? availableYears[0] : year;
  const maxYear = availableYears.length ? availableYears[availableYears.length - 1] : year;

  const yearDays = useMemo(() => {
    if (loading || !calendarDaily.length) return EMPTY_YEAR_BUCKETS;
    const byMo = bucketDailyByMonth(calendarDaily, year);
    if (!byMo) return EMPTY_YEAR_BUCKETS;
    return byMo.map((moDays) => ({ days: moDays, manual: 0 }));
  }, [calendarDaily, year, loading]);

  const monthDays = useMemo(() => yearDays[month - 1]?.days || [], [yearDays, month]);

  // Breakdown Data
  const breakdown = useMemo(() => {
    if (!overview?.source_html) return { symbol: [], session: [] };
    try {
      const parsed = JSON.parse(overview.source_html);
      return parsed.breakdown || { symbol: [], session: [] };
    } catch {
      return { symbol: [], session: [] };
    }
  }, [overview?.source_html]);

  if (loading) {
    return (
      <div className={pageShell}>
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-zinc-500">Loading strategy data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={pageShell}>
        <div className="flex h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Link Unavailable</h1>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">{error || 'Strategy not found or no longer public.'}</p>
          <Link to="/" className={`${btnSm} mt-6`}>Go to FinhubKH</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShell}>
      {/* Read-Only Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Shared Strategy
              </div>
              <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                {overview.name}
              </h1>
            </div>
          </div>
          <Link to="/" className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition">
            Create your own
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl p-4 md:p-6 lg:py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {overview.name}
          </h2>
          {overview.symbol && (
            <p className="text-sm text-zinc-500">{overview.symbol} backtest</p>
          )}
        </div>

        <nav className="mb-6 -mx-1 overflow-x-auto px-1 pb-1" aria-label="Backtest views">
          <div className={`${pillToggle} w-max min-w-full sm:min-w-0`} role="tablist">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'heatmap', label: 'Heatmap' },
              { id: 'calendar', label: 'Calendar' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={view === tab.id}
                className={`${pillBtn(view === tab.id)} px-4 py-1.5`}
                onClick={() => setView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {view === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <CalendarStatCard
                value={fmtPnlStrict(overview.total_pnl, uiCurrency)}
                label="Total PnL"
                trend={Number(overview.total_pnl) >= 0 ? 'up' : 'down'}
              />
              <CalendarStatCard
                value={Number(overview.profit_factor) > 999 ? '∞' : Number(overview.profit_factor).toFixed(2)}
                label="Profit factor"
                trend={Number(overview.profit_factor) >= 1.5 ? 'up' : Number(overview.profit_factor) >= 1 ? 'neutral' : 'down'}
              />
              <CalendarStatCard
                value={overview.trade_count}
                label="Trades"
                trend="neutral"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <EquityChart daily={calendarDaily} denomination={uiCurrency} />
              </div>
              <div className="flex flex-col gap-4">
                <WinRateGauge wins={Number(overview.wins) || 0} losses={Number(overview.losses) || 0} be={Number(overview.be_count) || 0} />
                <BreakdownCard items={breakdown.session} title="Session Breakdown" />
                <BreakdownCard items={breakdown.symbol} title="Symbol Breakdown" />
              </div>
            </div>

            <div className={`${card} p-5`}>
              <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Backtest Info</h3>
              <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-4">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Period</span>
                  <span className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {fmtDateShort(overview.range_from)} → {fmtDateShort(overview.range_to)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Currency</span>
                  <span className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 uppercase">
                    {uiCurrency}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Published</span>
                  <span className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {fmtDateShort(overview.published_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'heatmap' && (
          <HeatmapView daily={calendarDaily} denomination={uiCurrency} />
        )}

        {view === 'calendar' && (
          <div className="mt-2">
            {screen === 'year' ? (
              <YearView
                year={year}
                yearDays={loading ? EMPTY_YEAR_BUCKETS : yearDays}
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
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
