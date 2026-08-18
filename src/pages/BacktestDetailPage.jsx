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
import {
  YearView,
  MonthDetailView,
  CalendarStatCard,
} from '../components/calendar/CalendarViews';
import BreakdownCard from '../components/dashboard/BreakdownCard';
import HeatmapView from '../components/calendar/HeatmapView';
import EquityChart from '../components/dashboard/EquityChart';
import WinRateGauge from '../components/dashboard/WinRateGauge';
import {
  btnDanger,
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
  input,
  label,
  msgError,
  pillBtn,
  pillToggle,
  sectionLabel,
} from '../lib/ui';
import { deleteBacktest, fetchBacktest, fetchBacktestDaily, saveBacktestUpload } from '../api/backtests';

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

function Panel({ eyebrow, title, badge, children, danger = false }) {
  return (
    <section
      className={`${card} overflow-hidden ${
        danger ? 'border-rose-200 dark:border-rose-900/50' : ''
      }`}
    >
      <div className={cardHd}>
        <div className="min-w-0">
          <p className={`${sectionLabel} mb-1`}>{eyebrow}</p>
          <h2 className={cardTitle}>{title}</h2>
        </div>
        {badge}
      </div>
      <div className={cardBody}>{children}</div>
    </section>
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
      } catch (e) {
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
      toast.success('Backtest saved');
      setPreview(null);
      setSourceHtml(null);
      setFileLabel('');
      const days = await fetchBacktestDaily(backtestId);
      setDaily(days || []);
      const row = await fetchBacktest(backtestId);
      setBacktestRow(row);
    } catch (err) {
      toast.error(err?.message || 'Could not save backtest.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!backtestId) return;
    if (!window.confirm('Delete this strategy and all its data?')) return;
    try {
      await deleteBacktest(backtestId);
      toast.success('Strategy deleted');
      navigate('/dashboard/backtests');
    } catch (err) {
      toast.error(err?.message || 'Could not delete strategy.');
    }
  }

  if (!loading && !backtestRow && !error) {
    return (
      <div className={`${dashboardPageWideFull} overflow-y-auto`}>
        <BackButton onClick={() => navigate('/dashboard/backtests')} />
        <div className={`${card} ${emptyState} mt-6 py-14`}>
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
    <div className={`${dashboardPageWideFull} overflow-y-auto`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackButton onClick={() => navigate('/dashboard/backtests')} />
        <div className="flex flex-wrap gap-2">
          <label className={`${btnGhost} cursor-pointer`}>
            <input
              type="file"
              accept=".html,.htm,text/html"
              className="sr-only"
              onChange={onFile}
            />
            {parsing ? 'Parsing…' : hasUpload ? 'Re-upload report' : 'Upload report'}
          </label>
        </div>
      </div>

      {error ? (
        <div className={`${card} ${cardBody} mb-6`}>
          <p className={msgError}>{error}</p>
        </div>
      ) : null}



      {preview ? (
        <div className={`${card} mb-6`}>
          <div className={cardHd}>
            <h2 className={cardTitle}>Upload preview</h2>
            <StatusBadge ok okLabel="Ready to save" idleLabel="" />
          </div>
          <div className={`${cardBody} space-y-4`}>
            {fileLabel ? (
              <p className="text-xs text-zinc-500">File: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fileLabel}</span></p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Currency</div>
                <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{(preview.currencyRaw || preview.currency).toUpperCase()}</div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Range</div>
                <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{preview.rangeFrom} → {preview.rangeTo}</div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Net profit</div>
                <div className={`mt-1 text-sm font-bold ${preview.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                  {fmtPnlStrict(preview.totalPnl, preview.currency)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Closed deals</div>
                <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">{preview.tradeCount}</div>
              </div>
            </div>

            {preview.currencyWarning ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Could not recognize report currency "{preview.currencyRaw || 'unknown'}". Treating values as USD.
              </p>
            ) : null}

            <div className="flex gap-2">
              <button className={btnPrimary} type="button" disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save report'}
              </button>
              <button className={btnGhost} type="button" disabled={saving} onClick={() => { setPreview(null); setSourceHtml(null); setFileLabel(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {parseError ? (
        <div className={`${card} ${cardBody} mb-6`}>
          <p className={msgError}>{parseError}</p>
        </div>
      ) : null}

      {hasUpload ? (
        <>
          <div className="mb-4">
            <div className={pillToggle} role="tablist" aria-label="Backtest views">
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
                  className={pillBtn(view === tab.id)}
                  onClick={() => setView(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {view === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <CalendarStatCard
                  value={fmtPnlStrict(overview.totalPnl, uiCurrency)}
                  label="Total PnL"
                  valueClass={overview.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'}
                />
                <CalendarStatCard
                  value={formatPf(overview.profitFactor, overview.profitFactorInfinite)}
                  label="Profit factor"
                />
                <CalendarStatCard value={overview.tradeCount || '—'} label="Trades" />
              </div>

              <EquityChart daily={calendarDaily} denom={uiCurrency} />

              <div className="grid gap-4 lg:grid-cols-2">
                <WinRateGauge 
                  wins={overview.wins} 
                  losses={overview.losses} 
                />
                
                <BreakdownCard 
                  breakdown={overview.breakdown || { symbol: [], session: [] }} 
                  denomination={uiCurrency} 
                  fill 
                />
              </div>

              <Panel eyebrow="Performance" title="Strategy metrics">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Win rate</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{overview.wr}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Profit factor</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatPf(overview.profitFactor, overview.profitFactorInfinite)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Total trades</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{overview.tradeCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Trading days</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{calendarDaily.length}</span>
                  </div>
                </div>
              </Panel>
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


        </>
      ) : null}

    </div>
  );
}
