import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  dailyRowsForCalendar,
  decodeMt5ReportText,
  parseMt5StrategyTesterHtml,
} from '../lib/mt5BacktestParse';
import { bucketDailyByMonth, EMPTY_YEAR_BUCKETS, yearsFromDates } from '../lib/calendarCells';
import { fmtDateShort, fmtPnlStrict } from '../lib/format';
import BackButton from '../components/common/BackButton';
import YearDropdown from '../components/common/YearDropdown';
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
import {
  btnGhost,
  btnOutline,
  btnPrimary,
  btnSm,
  card,
  cardBody,
  cardHd,
  cardTitle,
  dashboardPageWideFull,
  emptyState,
  msgError,
  pillBtn,
  pillToggle,
} from '../lib/ui';
import {
  fetchBacktest,
  fetchBacktestDaily,
  saveBacktestUpload,
  getBacktestShareUrl,
  regenerateBacktestShareToken,
  setBacktestPublic,
} from '../api/backtests';

const EMPTY_OVERRIDE = {};

function StatusBadge({ ok, okLabel, idleLabel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        ok
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800'
      }`}
    >
      {ok ? okLabel : idleLabel}
    </span>
  );
}

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
  if (infinite) return '∞';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toFixed(2);
}

function metaFromBacktest(row) {
  if (!row) return null;
  const trades = Number(row.trade_count) || 0;
  const wins = Number(row.wins) || 0;
  const losses = Number(row.losses) || 0;
  const profitFactorInfinite = row.profit_factor == null && trades > 0 && losses === 0 && wins > 0;
  return {
    name: row.name,
    symbol: row.report_symbol,
    currency: row.currency === 'cent' ? 'cent' : 'usd',
    rangeFrom: row.range_from,
    rangeTo: row.range_to,
    totalPnl: Number(row.total_pnl) || 0,
    tradeCount: trades,
    wins,
    losses,
    beCount: Number(row.be_count) || 0,
    wr: trades > 0 ? Math.round((wins / trades) * 100) : 0,
    profitFactor: row.profit_factor,
    profitFactorInfinite,
    breakdown: (() => {
      try {
        if (row.source_html && row.source_html.startsWith('{')) {
          return JSON.parse(row.source_html);
        }
      } catch {
        // ignore
      }
      return { symbol: [], session: [] };
    })(),
  };
}

export default function BacktestDetailPage() {
  const { backtestId } = useParams();
  const navigate = useNavigate();

  const [backtestRow, setBacktestRow] = useState(null);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [fileLabel, setFileLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sourceHtml, setSourceHtml] = useState(null);

  const [view, setView] = useState('overview');
  const [screen, setScreen] = useState('year');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const calendarDaily = useMemo(() => dailyRowsForCalendar(daily), [daily]);
  const overview = useMemo(() => metaFromBacktest(backtestRow), [backtestRow]);
  const hasUpload = overview && overview.tradeCount > 0;
  const uiCurrency = overview?.currency === 'cent' ? 'cent' : 'usd';

  const availableYears = useMemo(
    () => yearsFromDates(calendarDaily, new Date().getFullYear()),
    [calendarDaily],
  );
  const minYear = availableYears[0];
  const maxYear = availableYears[availableYears.length - 1];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!backtestId) return;
      setLoading(true);
      setError('');
      try {
        const row = await fetchBacktest(backtestId);
        if (!cancelled) setBacktestRow(row);
        const days = await fetchBacktestDaily(backtestId);
        if (!cancelled) setDaily(days || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load backtest.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [backtestId]);

  useEffect(() => {
    if (!availableYears.includes(year)) {
      setYear(maxYear || new Date().getFullYear());
      setScreen('year');
    }
  }, [availableYears, year, maxYear]);

  const yearDays = useMemo(
    () => (loading ? EMPTY_YEAR_BUCKETS : bucketDailyByMonth(calendarDaily, year)),
    [calendarDaily, year, loading],
  );
  const monthDays = yearDays[month] || [];

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParseError('');
    setPreview(null);
    setSourceHtml(null);
    setParsing(true);
    setFileLabel(file.name);
    try {
      const buf = await file.arrayBuffer();
      setSourceHtml(decodeMt5ReportText(buf));
      const parsed = parseMt5StrategyTesterHtml(buf);
      setPreview(parsed);
    } catch (err) {
      setPreview(null);
      setParseError(err?.message || 'Could not parse this HTML report.');
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    if (!backtestId || !preview) return;
    setSaving(true);
    try {
      await saveBacktestUpload(backtestId, {
        currency: preview.currency,
        reportMeta: {
          symbol: preview.symbol,
          rangeFrom: preview.rangeFrom,
          rangeTo: preview.rangeTo,
          totalPnl: preview.totalPnl,
          tradeCount: preview.tradeCount,
          wins: preview.wins,
          losses: preview.losses,
          beCount: preview.beCount,
          profitFactor: preview.profitFactor,
          profitFactorInfinite: preview.profitFactorInfinite,
          breakdown: preview.breakdown || { symbol: [], session: [] },
        },
        dailyRows: preview.daily,
        sourceHtml,
      });
      const row = await fetchBacktest(backtestId);
      setBacktestRow(row);
      const days = await fetchBacktestDaily(backtestId);
      setDaily(days || []);
      setPreview(null);
      setSourceHtml(null);
      setFileLabel('');
      toast.success('Report saved successfully');
    } catch (err) {
      toast.error(err?.message || 'Could not save report.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishToggle() {
    setBusy(true);
    try {
      const updated = await setBacktestPublic(backtestId, !backtestRow.is_public);
      setBacktestRow(updated);
      toast.success(updated.is_public ? 'Backtest published' : 'Backtest is now private');
    } catch (e) {
      toast.error(e.message || 'Could not change public visibility.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateLink() {
    if (!window.confirm('This will break the old link. Are you sure?')) return;
    setBusy(true);
    try {
      const updated = await regenerateBacktestShareToken(backtestId);
      setBacktestRow(updated);
      toast.success('Share link regenerated');
    } catch (e) {
      toast.error(e.message || 'Could not regenerate share link.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    const shareUrl = getBacktestShareUrl(backtestRow);
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied');
    } catch {
      window.prompt('Copy this link:', shareUrl);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'calendar', label: 'Calendar' },
  ];

  if (!loading && !backtestRow && !error) {
    return (
      <div className={dashboardPageWideFull}>
        <div className="mb-4 shrink-0">
          <BackButton onClick={() => navigate('/dashboard/backtests')} />
        </div>
        <div className={`${card} ${emptyState} flex min-h-0 flex-1 flex-col items-center justify-center py-14`}>
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">Strategy not found</p>
          <p className="mt-2 text-sm text-zinc-500">It may have been deleted.</p>
          <button className={`${btnOutline} mt-5`} type="button" onClick={() => navigate('/dashboard/backtests')}>
            Back to strategies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={dashboardPageWideFull}>
      <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton onClick={() => navigate('/dashboard/backtests')} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {overview?.name || 'Strategy'}
              </h1>
              {hasUpload ? (
                <StatusBadge
                  ok={Boolean(backtestRow?.is_public)}
                  okLabel="Public"
                  idleLabel="Private"
                />
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {overview?.symbol ? `${overview.symbol} · ` : ''}
              {overview?.rangeFrom && overview?.rangeTo
                ? `${fmtDateShort(overview.rangeFrom)} → ${fmtDateShort(overview.rangeTo)}`
                : 'Upload an MT5 report to populate this backtest'}
            </p>
          </div>
        </div>

        {hasUpload && !preview ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${btnGhost} cursor-pointer`}>
              <input
                type="file"
                accept=".html,.htm,text/html"
                className="sr-only"
                onChange={onFile}
              />
              {parsing ? 'Parsing…' : 'Re-upload'}
            </label>
            <button className={btnSm} type="button" disabled={busy} onClick={() => void handlePublishToggle()}>
              {backtestRow?.is_public ? 'Unpublish' : 'Publish'}
            </button>
            {backtestRow?.is_public && getBacktestShareUrl(backtestRow) ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50">
                <input
                  type="text"
                  readOnly
                  value={getBacktestShareUrl(backtestRow)}
                  className="w-48 bg-transparent px-2 py-1 text-xs text-zinc-600 outline-none dark:text-zinc-400 sm:w-64"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  onClick={() => void handleCopyLink()}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg px-2 py-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  onClick={() => void handleRegenerateLink()}
                  title="Reset Link"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {error ? (
        <div className={`${card} ${cardBody} mb-4 shrink-0`}>
          <p className={msgError}>{error}</p>
        </div>
      ) : null}

      {parseError ? (
        <div className={`${card} ${cardBody} mb-4 shrink-0`}>
          <p className={msgError}>{parseError}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <span
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-zinc-700 dark:border-t-emerald-400"
            aria-hidden
          />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Loading strategy…</p>
        </div>
      ) : preview ? (
        <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className={`${cardHd} shrink-0`}>
            <div>
              <h2 className={cardTitle}>Upload preview</h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {fileLabel ? `File: ${fileLabel}` : 'Ready to save'}
              </p>
            </div>
            <StatusBadge ok okLabel="Ready to save" idleLabel="" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-5">
            <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Currency" value={(preview.currencyRaw || preview.currency).toUpperCase()} />
              <StatTile label="Range" value={`${preview.rangeFrom} → ${preview.rangeTo}`} />
              <StatTile
                label="Net profit"
                value={fmtPnlStrict(preview.totalPnl, preview.currency)}
                tone={preview.totalPnl >= 0 ? 'positive' : 'negative'}
              />
              <StatTile label="Closed deals" value={preview.tradeCount} hint={`${preview.wins || 0}W · ${preview.losses || 0}L`} />
            </div>
            {preview.currencyWarning ? (
              <p className="shrink-0 text-sm text-amber-600 dark:text-amber-400">
                Could not recognize report currency "{preview.currencyRaw || 'unknown'}". Treating values as USD.
              </p>
            ) : null}
            <div className="mt-auto flex shrink-0 gap-2">
              <button className={btnPrimary} type="button" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save report'}
              </button>
              <button className={btnGhost} type="button" disabled={saving} onClick={() => { setPreview(null); setSourceHtml(null); setFileLabel(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : !hasUpload && !error ? (
        <div className={`${card} ${emptyState} flex min-h-0 flex-1 flex-col items-center justify-center py-16`}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No data uploaded yet</h3>
          <p className="mx-auto mt-2 mb-8 max-w-sm text-sm text-zinc-500">
            Upload your MT5 Strategy Tester HTML report to generate the performance overview, charts, and session breakdowns.
          </p>
          <label className={`${btnPrimary} cursor-pointer`}>
            <input
              type="file"
              accept=".html,.htm,text/html"
              className="sr-only"
              onChange={onFile}
            />
            {parsing ? 'Parsing…' : 'Upload MT5 Report'}
          </label>
        </div>
      ) : hasUpload ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <nav className="overflow-x-auto" aria-label="Backtest views">
                <div className={`${pillToggle} !flex w-max min-w-full sm:min-w-0`} role="tablist">
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
                    <button className={btnGhost} type="button" onClick={() => setYear(new Date().getFullYear())}>
                      Go to {new Date().getFullYear()}
                    </button>
                  )}
                </div>
              )}
            </div>
            {view === 'calendar' && screen === 'year' && (
              <p className="hidden text-xs text-zinc-400 xl:block">Select a month to view daily backtest PnL</p>
            )}
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
                    value={fmtPnlStrict((overview?.breakdown?.initialDeposit || 0) + (Number(overview.totalPnl) || 0), uiCurrency)}
                    hint="Final account balance"
                  />
                  <StatTile
                    label="Total PnL"
                    value={fmtPnlStrict(overview.totalPnl, uiCurrency)}
                    hint={`${overview.wins}W · ${overview.losses}L`}
                    tone={overview.totalPnl >= 0 ? 'positive' : 'negative'}
                  />
                  <StatTile
                    label="Profit factor"
                    value={formatPf(overview.profitFactor, overview.profitFactorInfinite)}
                    hint="Gross wins ÷ gross losses"
                    tone={overview.profitFactorInfinite || Number(overview.profitFactor) >= 1 ? 'positive' : 'negative'}
                  />
                  <StatTile
                    label="Win rate"
                    value={`${overview.wr}%`}
                    hint={`${overview.tradeCount} closed`}
                    tone={overview.wr >= 50 ? 'positive' : 'negative'}
                  />
                  <StatTile
                    label="Trades"
                    value={overview.tradeCount || '—'}
                    hint={`${calendarDaily.length} trading days`}
                  />
                  <StatTile
                    label="Currency"
                    value={uiCurrency.toUpperCase()}
                    hint={overview.symbol || 'Strategy tester'}
                  />
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:overflow-hidden">
                  <div className="flex min-h-0 flex-1 flex-col gap-3 lg:min-h-0">
                    <div className="min-h-[240px] flex-1 lg:min-h-0">
                      <EquityChart daily={calendarDaily} denomination={uiCurrency} initialDeposit={overview?.breakdown?.initialDeposit || 0} fill />
                    </div>
                    <div className="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2">
                      <RiskCard overview={overview} daily={calendarDaily} denomination={uiCurrency} />
                      <HighlightsCard overview={overview} daily={calendarDaily} denomination={uiCurrency} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 lg:h-full lg:w-[min(22rem,38%)]">
                    <div className="shrink-0">
                      <WinRateGauge wins={overview.wins} losses={overview.losses} fill />
                    </div>
                    <div className="min-h-0 flex-1">
                      <BreakdownCard
                        breakdown={overview.breakdown || { symbol: [], session: [] }}
                        denomination={uiCurrency}
                        fill
                      />
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
        </div>
      ) : null}
    </div>
  );
}
