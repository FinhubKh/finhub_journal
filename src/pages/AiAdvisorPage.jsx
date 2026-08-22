import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  LuCircleAlert,
  LuLightbulb,
  LuSend,
  LuSparkles,
  LuThumbsUp,
  LuTrash2,
} from 'react-icons/lu';
import {
  analyzeAiPerformance,
  chatAiPerformance,
  clearAiChatHistory,
  deleteAiPerformanceReport,
  fetchAiChatHistory,
  fetchAiPerformanceStats,
  listAiPerformanceReports,
} from '../api/ai';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  card,
  cardBody,
  dashboardPageWide,
  emptyState,
  input,
  label,
  msgError,
} from '../lib/ui';
import { computePreviousPeriod } from '../lib/aiAdvisorHelpers';
import CustomDropdown from '../components/common/CustomDropdown';
import RiskBanner from '../components/aiadvisor/RiskBanner';
import PacingBar from '../components/aiadvisor/PacingBar';
import DisciplineStreak from '../components/aiadvisor/DisciplineStreak';
import JumpNav from '../components/aiadvisor/JumpNav';

const RANGE_OPTIONS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'custom', label: 'Custom' },
];

const INSIGHT_GROUPS = [
  {
    id: 'strengths',
    tone: 'positive',
    label: 'Strengths',
    empty: 'No strengths flagged for this period.',
    icon: LuThumbsUp,
    accent: 'border-l-emerald-500',
    iconWrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    title: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'risks',
    tone: 'warning',
    label: 'Risks',
    empty: 'No risks flagged for this period.',
    icon: LuCircleAlert,
    accent: 'border-l-amber-500',
    iconWrap: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    title: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'focus',
    tone: 'neutral',
    label: 'Focus',
    empty: 'No focus points for this period.',
    icon: LuLightbulb,
    accent: 'border-l-violet-500',
    iconWrap: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
    title: 'text-violet-700 dark:text-violet-300',
  },
];

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rangeFromPreset(preset) {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(to.getDate() - 6);
  else if (preset === '90d') from.setDate(to.getDate() - 89);
  else from.setDate(to.getDate() - 29);
  return { from: formatLocalDate(from), to: formatLocalDate(to) };
}

function groupInsights(insights) {
  const buckets = { positive: [], warning: [], neutral: [] };
  for (const item of insights) {
    const tone = item?.tone === 'positive' || item?.tone === 'warning' ? item.tone : 'neutral';
    buckets[tone].push(item);
  }
  return buckets;
}

const METRIC_TILES = [
  { key: 'sharpe', label: 'Sharpe (R)', format: (s) => (s.sharpe == null ? '—' : s.sharpe.toFixed(2)) },
  { key: 'sortino', label: 'Sortino (R)', format: (s) => (s.sortino == null ? '—' : s.sortino.toFixed(2)) },
  { key: 'max_drawdown', label: 'Max Drawdown', format: (s) => (s.max_drawdown ? `-${s.max_drawdown.pct.toFixed(1)}%` : '—') },
  { key: 'profit_factor', label: 'Profit Factor', format: (s) => (s.profit_factor == null ? '—' : s.profit_factor.toFixed(2)) },
  { key: 'expectancy', label: 'Expectancy', format: (s) => (s.expectancy == null ? '—' : `${s.expectancy >= 0 ? '+' : ''}${s.expectancy.toFixed(2)}R`) },
  { key: 'kelly_half_pct', label: 'Half-Kelly Size', format: (s) => (s.kelly_half_pct == null ? '—' : `${s.kelly_half_pct.toFixed(1)}%`) },
];

function MetricsStrip({ summary, busy }) {
  if (busy) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_TILES.map((tile) => (
          <div key={tile.key} className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }
  if (!summary || summary.trade_count === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {METRIC_TILES.map((tile) => (
        <div
          key={tile.key}
          className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
            {tile.label}
          </p>
          <p className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {tile.format(summary)}
          </p>
        </div>
      ))}
    </div>
  );
}

function InsightsGroupedView({ insights }) {
  const grouped = groupInsights(insights);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {INSIGHT_GROUPS.map((group) => {
        const Icon = group.icon;
        const items = grouped[group.tone];
        const borderTopClass =
          group.tone === 'positive'
            ? 'border-t-emerald-500'
            : group.tone === 'warning'
              ? 'border-t-amber-500'
              : 'border-t-violet-500';

        return (
          <section
            key={group.id}
            className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 border-t-4 bg-white shadow-xs transition-all duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 ${borderTopClass}`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${group.iconWrap}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className={`text-sm font-bold tracking-tight ${group.title}`}>{group.label}</h3>
              </div>
              <span className="rounded-full bg-zinc-200/60 px-2.5 py-0.5 text-xs font-bold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {items.length}
              </span>
            </div>

            {/* Column Content */}
            <div className="flex-1 p-4">
              {items.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-200 p-4 text-center dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{group.empty}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={`${group.id}-${idx}-${item.title}`}
                      className="group/item rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 transition-all hover:border-zinc-200 hover:bg-white dark:border-zinc-800/90 dark:bg-zinc-950/40 dark:hover:border-zinc-700/80 dark:hover:bg-zinc-900"
                    >
                      <h4 className="text-sm font-bold text-zinc-900 transition-colors group-hover/item:text-violet-600 dark:text-zinc-100 dark:group-hover/item:text-violet-400">
                        {item.title}
                      </h4>
                      <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AttributionTable({ summary }) {
  const groups = [
    { key: 'by_session', label: 'Session' },
    { key: 'by_symbol', label: 'Symbol' },
    { key: 'by_weekday', label: 'Weekday' },
    { key: 'by_model', label: 'Model' },
  ];
  const rows = groups.flatMap((g) =>
    (summary?.[g.key] || []).slice(0, 4).map((row) => ({ ...row, group: g.label })),
  );
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-400 dark:bg-zinc-950/40 dark:text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Segment</th>
            <th className="px-3 py-2 text-left font-semibold">Name</th>
            <th className="px-3 py-2 text-right font-semibold">Trades</th>
            <th className="px-3 py-2 text-right font-semibold">Edge (avg R)</th>
            <th className="px-3 py-2 text-right font-semibold">PnL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={`${row.group}-${row.name}`}>
              <td className="px-3 py-2 text-zinc-400 dark:text-zinc-500">{row.group}</td>
              <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{row.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{row.trades}</td>
              <td className={`px-3 py-2 text-right font-mono tabular-nums ${row.avg_r >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {row.avg_r >= 0 ? '+' : ''}{row.avg_r}R
              </td>
              <td className={`px-3 py-2 text-right font-mono tabular-nums ${row.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {row.pnl >= 0 ? '+' : ''}{row.pnl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportSection({ heading, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
        {heading}
      </h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-500" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportBody({ content, statsSnapshot }) {
  if (!content) return null;

  return (
    <div className="space-y-6">
      {content.summary ? (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            Executive Summary
          </h4>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{content.summary}</p>
        </div>
      ) : null}

      {statsSnapshot ? (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            Performance Attribution
          </h4>
          <AttributionTable summary={statsSnapshot} />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ReportSection heading="Performance drivers" items={content.working} />
        <ReportSection heading="Risk factors" items={content.hurting} />
        <ReportSection heading="Behavioral flags" items={content.habits} />
        <ReportSection heading="Trading directives" items={content.action_plan} />
      </div>

      {content.focus_next ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800/60 dark:bg-violet-950/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-500 dark:text-violet-400">
            Primary Focus
          </p>
          <p className="mt-1 text-sm font-medium text-violet-900 dark:text-violet-200">{content.focus_next}</p>
        </div>
      ) : null}
    </div>
  );
}

const ROTATING_STATUSES = [
  'Evaluating win rate & risk multipliers…',
  'Analyzing trade risk-to-reward consistency…',
  'Scanning loss streaks & drawdown patterns…',
  'Synthesizing actionable performance insights…',
  'Finalizing AI performance report…',
];

function AnalysisProgressModal({ open, percent, label }) {
  const [subtextIdx, setSubtextIdx] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const interval = setInterval(() => {
      setSubtextIdx((i) => (i + 1) % ROTATING_STATUSES.length);
    }, 2200);

    return () => {
      document.body.style.overflow = prev;
      clearInterval(interval);
    };
  }, [open]);

  if (!open) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const currentSubtext = ROTATING_STATUSES[subtextIdx];

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-progress-title"
    >
      <div className={`${card} w-full max-w-md shadow-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800`}>
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3.5">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-500/20">
              <LuSparkles className="h-6 w-6 animate-pulse" aria-hidden />
              <span className="absolute -inset-1 rounded-2xl border border-violet-400/40 animate-ping" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 id="analysis-progress-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Running analysis
                </h2>
                <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-ping" />
              </div>
              <p className="mt-0.5 text-xs font-medium text-violet-600 dark:text-violet-400 transition-all duration-300 animate-pulse">
                {label || currentSubtext}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                {currentSubtext}
              </span>
              <span className="tabular-nums font-mono text-violet-600 dark:text-violet-300 font-bold">{clamped}%</span>
            </div>

            {/* Progress Bar Container with Continuous Shimmer */}
            <div
              className="relative h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clamped}
              aria-label="Analysis progress"
            >
              {/* Progress Fill Bar */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-400 transition-[width] duration-300 ease-out shadow-xs"
                style={{ width: `${clamped}%` }}
              />

              {/* Continuous Light Beam Overlay across full progress bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse opacity-75" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiAdvisorPage() {
  const { tradingAccounts, activeAccountId, setActiveAccountId, dataLoading } = useAppData();
  const { confirm } = useDialog();

  const defaultAccountId = activeAccountId || tradingAccounts.find((a) => a.is_default)?.id || tradingAccounts[0]?.id || '';
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(() => rangeFromPreset('30d').from);
  const [to, setTo] = useState(() => rangeFromPreset('30d').to);
  const [language, setLanguage] = useState('en');
  const sectionRefs = useRef({});
  const setSectionRef = (id) => (el) => {
    sectionRefs.current[id] = el;
  };

  const [insights, setInsights] = useState([]);
  const [insightsError, setInsightsError] = useState('');

  const [statsSummary, setStatsSummary] = useState(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [previousStatsSummary, setPreviousStatsSummary] = useState(null);
  const [previousStatsBusy, setPreviousStatsBusy] = useState(false);

  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [messages, setMessages] = useState([]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisPercent, setAnalysisPercent] = useState(0);
  const [analysisLabel, setAnalysisLabel] = useState('Preparing…');
  const analysisBusy = analysisOpen;

  useEffect(() => {
    if (!accountId && defaultAccountId) setAccountId(defaultAccountId);
  }, [accountId, defaultAccountId]);

  useEffect(() => {
    if (preset === 'custom') return;
    const next = rangeFromPreset(preset);
    setFrom(next.from);
    setTo(next.to);
  }, [preset]);

  const accountOptions = useMemo(
    () => tradingAccounts.map((a) => ({ value: a.id, label: a.name })),
    [tradingAccounts],
  );

  const selectedAccountName = useMemo(
    () => tradingAccounts.find((a) => a.id === accountId)?.name || 'Account',
    [tradingAccounts, accountId],
  );

  async function refreshHistory(nextAccountId = accountId) {
    if (!nextAccountId) {
      setHistory([]);
      return;
    }
    setHistoryBusy(true);
    try {
      const rows = await listAiPerformanceReports(nextAccountId);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryBusy(false);
    }
  }

  useEffect(() => {
    void refreshHistory(accountId);
    setInsights([]);
    setReport(null);
    setSelectedHistoryId(null);
    if (accountId) {
      fetchAiChatHistory(accountId)
        .then((rows) => setMessages(rows.map((r) => ({ role: r.role, content: r.content }))))
        .catch(() => setMessages([]));
    } else {
      setMessages([]);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !from || !to) {
      setStatsSummary(null);
      return;
    }
    let cancelled = false;
    setStatsBusy(true);
    fetchAiPerformanceStats({ accountId, from, to, language })
      .then((summary) => {
        if (!cancelled) setStatsSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setStatsSummary(null);
      })
      .finally(() => {
        if (!cancelled) setStatsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, from, to, language]);

  useEffect(() => {
    if (!accountId || !from || !to) {
      setPreviousStatsSummary(null);
      return;
    }
    const { from: prevFrom, to: prevTo } = computePreviousPeriod(from, to);
    let cancelled = false;
    setPreviousStatsBusy(true);
    fetchAiPerformanceStats({ accountId, from: prevFrom, to: prevTo, language })
      .then((summary) => {
        if (!cancelled) setPreviousStatsSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setPreviousStatsSummary(null);
      })
      .finally(() => {
        if (!cancelled) setPreviousStatsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, from, to, language]);

  function onAccountChange(id) {
    setAccountId(id);
    setActiveAccountId(id);
  }

  async function handleGetAnalysis() {
    if (!accountId) {
      toast.error('Select a trading account first.');
      return;
    }
    if (analysisBusy) return;

    setAnalysisOpen(true);
    setAnalysisPercent(20);
    setAnalysisLabel('Analyzing trades…');
    setInsightsError('');
    setReportError('');

    try {
      const data = await analyzeAiPerformance({ accountId, from, to, language });

      const nextInsights = Array.isArray(data.insights) ? data.insights : [];
      setInsights(nextInsights);
      if (nextInsights.length === 0) setInsightsError('No insights returned.');

      const next = data.report || {
        id: null,
        title: data.title,
        content: data.content,
        from_date: from,
        to_date: to,
        language,
        created_at: new Date().toISOString(),
      };
      setReport(next);
      setSelectedHistoryId(next.id || null);
      if (next?.id) {
        setHistory((prev) => [next, ...prev.filter((r) => r.id !== next.id)]);
      } else {
        void refreshHistory(accountId);
      }

      toast.success('Insights and report ready');
    } catch (err) {
      setInsightsError(err.message || 'Could not generate analysis.');
      setReportError(err.message || 'Could not generate analysis.');
      toast.error(err.message || 'Analysis failed. Try again.');
    } finally {
      setAnalysisOpen(false);
      setAnalysisPercent(0);
      setAnalysisLabel('Preparing…');
    }
  }

  async function handleDeleteReport(id) {
    const ok = await confirm({
      title: 'Delete report?',
      message: 'This removes the saved performance report.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAiPerformanceReport(id);
      if (selectedHistoryId === id) {
        setSelectedHistoryId(null);
        setReport(null);
      }
      await refreshHistory(accountId);
      toast.success('Report deleted');
    } catch (err) {
      toast.error(err.message || 'Could not delete report');
    }
  }

  async function handleClearChat() {
    if (!accountId) return;
    const ok = await confirm({
      title: 'Clear chat history?',
      message: 'This removes all saved advisor chat messages for this account.',
      confirmLabel: 'Clear',
      destructive: true,
    });
    if (!ok) return;
    try {
      await clearAiChatHistory(accountId);
      setMessages([]);
      setChatError('');
      toast.success('Chat history cleared');
    } catch (err) {
      toast.error(err.message || 'Could not clear chat history');
    }
  }

  async function handleChat(e) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    if (!accountId) {
      setChatError('Select a trading account first.');
      return;
    }

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setChatInput('');
    setChatBusy(true);
    setChatError('');
    try {
      const reply = await chatAiPerformance({
        accountId,
        from,
        to,
        language,
        message: text,
        history: nextMessages.slice(-8),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setChatError(err.message || 'Chat failed.');
      setMessages((prev) => prev.slice(0, -1));
      setChatInput(text);
    } finally {
      setChatBusy(false);
    }
  }

  if (dataLoading) {
    return (
      <div className={dashboardPageWide}>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading AI Advisor…</p>
      </div>
    );
  }

  if (tradingAccounts.length === 0) {
    return (
      <div className={dashboardPageWide}>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">AI Advisor</h1>
        <div className={`${card} ${emptyState} mt-4`}>
          <p>Add a trading account in Settings before using AI Advisor.</p>
        </div>
      </div>
    );
  }

  const activeHistory = history.find((r) => r.id === selectedHistoryId) || null;
  const shownReport = activeHistory || report;

  return (
    <div className={dashboardPageWide}>
      <header className="mb-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
          Performance advisor
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">AI Advisor</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review {selectedAccountName} from {from} to {to}
        </p>
      </header>

      <section className={`${card} mb-5 overflow-visible z-20 relative`}>
        <div className="flex flex-wrap items-end justify-between gap-4 p-4 md:px-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className={label}>Account</label>
              <CustomDropdown
                className="w-48"
                menuClassName="w-48"
                value={accountId}
                onChange={onAccountChange}
                options={accountOptions}
                ariaLabel="Trading account"
              />
            </div>

            <div>
              <label className={label}>Period</label>
              <div className="flex flex-wrap gap-1.5">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={analysisBusy}
                    onClick={() => setPreset(opt.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      preset === opt.id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={label}>Language</label>
              <div className="flex gap-1.5">
                {[
                  { id: 'en', label: 'EN' },
                  { id: 'km', label: 'KM' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={analysisBusy}
                    onClick={() => setLanguage(opt.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      language === opt.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`${btnPrimary} inline-flex items-center gap-2`}
            disabled={analysisBusy || !accountId}
            onClick={() => void handleGetAnalysis()}
          >
            <LuSparkles className="h-4 w-4" aria-hidden />
            {analysisBusy ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {preset === 'custom' ? (
          <div className="grid gap-3 border-t border-zinc-100 p-4 dark:border-zinc-800 sm:grid-cols-2 md:px-5">
            <div>
              <label className={label}>From</label>
              <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className={label}>To</label>
              <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-5">
          <div ref={setSectionRef('risk')} className="space-y-5">
            <RiskBanner summary={statsSummary} />
            <MetricsStrip summary={statsSummary} busy={statsBusy} />
            <div className="grid gap-4 sm:grid-cols-2">
              <PacingBar summary={statsSummary} previousSummary={previousStatsSummary} previousBusy={previousStatsBusy} />
              <DisciplineStreak summary={statsSummary} />
            </div>
          </div>

          <section ref={setSectionRef('insights')} className={card}>
            <div className="border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800 md:px-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Insights</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Grouped into strengths, risks, and focus.</p>
            </div>
            <div className={cardBody}>
              {insightsError ? <p className={`mb-3 ${msgError}`}>{insightsError}</p> : null}
              {insights.length > 0 ? (
                <InsightsGroupedView insights={insights} />
              ) : !insightsError ? (
                <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  Click Analyze above to generate insights for this period.
                </p>
              ) : null}
            </div>
          </section>

          <section ref={setSectionRef('report')} className={card}>
            <div className="border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800 md:px-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Report</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Saved advisor write-ups for this account.</p>
            </div>
            <div className="p-4 md:p-5">
              {reportError ? <p className={`mb-3 ${msgError}`}>{reportError}</p> : null}
              {shownReport ? (
                <div>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {shownReport.title}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                        {shownReport.from_date || from} → {shownReport.to_date || to}
                        {shownReport.created_at ? ` · ${new Date(shownReport.created_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                    {shownReport.id ? (
                      <button
                        className={`${btnDanger} inline-flex items-center gap-1.5`}
                        type="button"
                        onClick={() => void handleDeleteReport(shownReport.id)}
                      >
                        <LuTrash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <ReportBody content={shownReport.content} statsSnapshot={shownReport.stats_snapshot} />
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  {history.length > 0
                    ? 'Pick a saved report from History, or click Analyze above to generate a new one.'
                    : 'Click Analyze above to generate a report for this period.'}
                </p>
              )}

              {history.length > 0 ? (
                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      History
                    </h4>
                    {historyBusy ? <span className="text-[11px] text-zinc-400">Loading…</span> : null}
                  </div>
                  <CustomDropdown
                    className="w-full sm:w-80"
                    menuClassName="w-full sm:w-80"
                    value={selectedHistoryId}
                    onChange={(id) => {
                      const row = history.find((r) => r.id === id);
                      setSelectedHistoryId(id);
                      setReport(row || null);
                    }}
                    options={history.map((row) => ({
                      value: row.id,
                      label: `${row.title}${row.created_at ? ` · ${new Date(row.created_at).toLocaleDateString()}` : ''}`,
                    }))}
                    ariaLabel="Saved report history"
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section ref={setSectionRef('chat')} className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800 md:px-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chat</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Persistent thread for this account.</p>
              </div>
              <button className={btnGhost} type="button" onClick={() => void handleClearChat()}>
                Clear
              </button>
            </div>

            <div className="flex min-h-[28rem] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50/50 p-4 dark:bg-zinc-950/30 md:p-5">
                {messages.length === 0 ? (
                  <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ask about your performance</p>
                    <p className="mt-1 max-w-sm text-sm text-zinc-400 dark:text-zinc-500">
                      Example: Why are my London session losses high?
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-violet-600 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:px-5">
                {chatError ? <p className={`mb-2 ${msgError}`}>{chatError}</p> : null}
                <form className="flex gap-2" onSubmit={(e) => void handleChat(e)}>
                  <input
                    className={`${input} min-w-0 flex-1`}
                    placeholder="Ask a question about this period…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatBusy}
                  />
                  <button
                    className={`${btnPrimary} !px-4 inline-flex items-center gap-2`}
                    type="submit"
                    disabled={chatBusy || !chatInput.trim()}
                  >
                    <LuSend className="h-4 w-4" aria-hidden />
                    {chatBusy ? '…' : 'Send'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>

        <JumpNav sectionRefs={sectionRefs} />
      </div>

      <AnalysisProgressModal open={analysisOpen} percent={analysisPercent} label={analysisLabel} />
    </div>
  );
}
