import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  LuCircleAlert,
  LuFileText,
  LuLightbulb,
  LuMessageSquare,
  LuRefreshCw,
  LuSend,
  LuSparkles,
  LuThumbsUp,
  LuTrash2,
} from 'react-icons/lu';
import {
  chatAiPerformance,
  deleteAiPerformanceReport,
  fetchAiPerformanceInsights,
  generateAiPerformanceReport,
  listAiPerformanceReports,
} from '../api/ai';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import {
  btnDanger,
  btnGhost,
  btnOutline,
  btnPrimary,
  btnSm,
  card,
  cardBody,
  dashboardPageWide,
  emptyState,
  input,
  label,
  msgError,
} from '../lib/ui';
import CustomDropdown from '../components/common/CustomDropdown';

const SECTIONS = [
  { id: 'insights', label: 'Insights', icon: LuLightbulb },
  { id: 'report', label: 'Report', icon: LuFileText },
  { id: 'chat', label: 'Chat', icon: LuMessageSquare },
];

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

function SectionNav({ activeSection, onChange }) {
  return (
    <div
      className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
      role="tablist"
      aria-label="AI Coach sections"
    >
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(section.id)}
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition ${
              active
                ? 'text-violet-700 dark:text-violet-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {section.label}
            {active ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-violet-600 dark:bg-violet-400" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function EmptyPanel({ title, detail, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
        <LuSparkles className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{detail}</p>
      {action || null}
    </div>
  );
}

function InsightsGroupedView({ insights }) {
  const grouped = groupInsights(insights);

  return (
    <div className="space-y-4">
      {INSIGHT_GROUPS.map((group) => {
        const Icon = group.icon;
        const items = grouped[group.tone];
        return (
          <section
            key={group.id}
            className={`rounded-2xl border border-zinc-200 border-l-4 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${group.accent}`}
          >
            <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${group.iconWrap}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-semibold ${group.title}`}>{group.label}</h3>
              </div>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {items.length}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-zinc-400 dark:text-zinc-500">{group.empty}</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((item) => (
                  <li key={`${group.id}-${item.title}-${item.detail}`} className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ReportBody({ content }) {
  if (!content) return null;
  const blocks = [
    ['What is working', content.working],
    ['What is hurting', content.hurting],
    ['Habits / flags', content.habits],
    ['Action plan', content.action_plan],
  ];

  return (
    <div className="space-y-6">
      {content.summary ? (
        <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{content.summary}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {blocks.map(([heading, items]) => (
          Array.isArray(items) && items.length > 0 ? (
            <div key={heading} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
          ) : null
        ))}
      </div>

      {content.focus_next ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800/60 dark:bg-violet-950/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-500 dark:text-violet-400">
            Next focus
          </p>
          <p className="mt-1 text-sm font-medium text-violet-900 dark:text-violet-200">{content.focus_next}</p>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisProgressModal({ open, percent, label }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-progress-title"
    >
      <div className={`${card} w-full max-w-md shadow-2xl`}>
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <LuSparkles className="h-5 w-5 animate-pulse" aria-hidden />
            </span>
            <div>
              <h2 id="analysis-progress-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Running analysis
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
              <span className="tabular-nums text-violet-600 dark:text-violet-300">{clamped}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clamped}
              aria-label="Analysis progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-[width] duration-300 ease-out"
                style={{ width: `${clamped}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiCoachPage() {
  const { tradingAccounts, activeAccountId, setActiveAccountId, dataLoading } = useAppData();
  const { confirm } = useDialog();

  const defaultAccountId = activeAccountId || tradingAccounts.find((a) => a.is_default)?.id || tradingAccounts[0]?.id || '';
  const [activeSection, setActiveSection] = useState('insights');
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(() => rangeFromPreset('30d').from);
  const [to, setTo] = useState(() => rangeFromPreset('30d').to);
  const [language, setLanguage] = useState('en');

  const [insights, setInsights] = useState([]);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  const [report, setReport] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
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
    setMessages([]);
    setInsights([]);
    setReport(null);
    setSelectedHistoryId(null);
  }, [accountId]);

  function onAccountChange(id) {
    setAccountId(id);
    setActiveAccountId(id);
  }

  async function handleInsights() {
    if (!accountId) {
      setInsightsError('Select a trading account first.');
      return;
    }
    setInsightsBusy(true);
    setInsightsError('');
    try {
      const data = await fetchAiPerformanceInsights({ accountId, from, to, language });
      setInsights(data.insights);
      if (data.insights.length === 0) setInsightsError('No insights returned.');
    } catch (err) {
      setInsights([]);
      setInsightsError(err.message || 'Could not generate insights.');
    } finally {
      setInsightsBusy(false);
    }
  }

  async function handleReport() {
    if (!accountId) {
      setReportError('Select a trading account first.');
      return;
    }
    setReportBusy(true);
    setReportError('');
    try {
      const data = await generateAiPerformanceReport({ accountId, from, to, language });
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
      await refreshHistory(accountId);
      toast.success('Report generated and saved');
    } catch (err) {
      setReportError(err.message || 'Could not generate report.');
    } finally {
      setReportBusy(false);
    }
  }

  async function handleGetAnalysis() {
    if (!accountId) {
      toast.error('Select a trading account first.');
      return;
    }
    if (analysisBusy || insightsBusy || reportBusy) return;

    setAnalysisOpen(true);
    setAnalysisPercent(5);
    setAnalysisLabel('Preparing your trade data…');
    setInsightsError('');
    setReportError('');

    let insightsOk = false;
    let reportOk = false;

    try {
      setAnalysisPercent(15);
      setAnalysisLabel('Generating insights…');
      try {
        const data = await fetchAiPerformanceInsights({ accountId, from, to, language });
        setInsights(data.insights);
        insightsOk = data.insights.length > 0;
        if (!insightsOk) setInsightsError('No insights returned.');
      } catch (err) {
        setInsights([]);
        setInsightsError(err.message || 'Could not generate insights.');
      }

      setAnalysisPercent(55);
      setAnalysisLabel('Writing performance report…');
      try {
        const data = await generateAiPerformanceReport({ accountId, from, to, language });
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
        await refreshHistory(accountId);
        reportOk = true;
      } catch (err) {
        setReportError(err.message || 'Could not generate report.');
      }

      setAnalysisPercent(100);
      setAnalysisLabel('Analysis complete');
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (insightsOk || reportOk) {
        setActiveSection(insightsOk ? 'insights' : 'report');
        if (insightsOk && reportOk) toast.success('Insights and report ready');
        else if (insightsOk) toast.success('Insights ready');
        else toast.success('Report ready');
      } else {
        toast.error('Analysis failed. Try again.');
      }
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
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading AI Coach…</p>
      </div>
    );
  }

  if (tradingAccounts.length === 0) {
    return (
      <div className={dashboardPageWide}>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">AI Coach</h1>
        <div className={`${card} ${emptyState} mt-4`}>
          <p>Add a trading account in Settings before using AI Coach.</p>
        </div>
      </div>
    );
  }

  const activeHistory = history.find((r) => r.id === selectedHistoryId) || null;
  const shownReport = activeHistory || report;

  return (
    <div className={dashboardPageWide}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            Performance coach
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">AI Coach</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Review {selectedAccountName} from {from} to {to}
          </p>
        </div>
        <button
          type="button"
          className={`${btnPrimary} inline-flex items-center gap-2`}
          disabled={analysisBusy || !accountId}
          onClick={() => void handleGetAnalysis()}
        >
          <LuSparkles className="h-4 w-4" aria-hidden />
          {analysisBusy ? 'Analyzing…' : 'Get analysis'}
        </button>
      </header>

      <section className={`${card} mb-5 overflow-hidden`}>
        <div className="grid gap-4 border-b border-zinc-100 p-4 dark:border-zinc-800 md:grid-cols-[1.2fr_1fr_auto] md:items-end md:gap-5 md:px-5">
          <div>
            <label className={label}>Account</label>
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
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

        {preset === 'custom' ? (
          <div className="grid gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800 sm:grid-cols-2 md:px-5">
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

        <SectionNav activeSection={activeSection} onChange={setActiveSection} />
      </section>

      {activeSection === 'insights' && (
        <section className={card} role="tabpanel" aria-label="Insights">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800 md:px-5">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Insights</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Grouped into strengths, risks, and focus.</p>
            </div>
            <button
              className={`${btnSm} inline-flex items-center gap-1.5`}
              type="button"
              disabled={insightsBusy || analysisBusy}
              onClick={() => void handleInsights()}
            >
              <LuRefreshCw className={`h-3.5 w-3.5 ${insightsBusy ? 'animate-spin' : ''}`} aria-hidden />
              {insightsBusy ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className={cardBody}>
            {insightsError ? <p className={`mb-3 ${msgError}`}>{insightsError}</p> : null}
            {insights.length === 0 && !insightsBusy && !insightsError ? (
              <EmptyPanel
                title="No insights yet"
                detail="Run a full analysis to generate strengths, risks, and focus points for this period."
                action={(
                  <button
                    type="button"
                    className={`${btnPrimary} mt-4 inline-flex items-center gap-2`}
                    disabled={analysisBusy}
                    onClick={() => void handleGetAnalysis()}
                  >
                    <LuSparkles className="h-4 w-4" aria-hidden />
                    Get analysis
                  </button>
                )}
              />
            ) : null}
            {insights.length > 0 ? <InsightsGroupedView insights={insights} /> : null}
          </div>
        </section>
      )}

      {activeSection === 'report' && (
        <section className={card} role="tabpanel" aria-label="Report">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800 md:px-5">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Report</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Saved coach write-ups for this account.</p>
            </div>
            <button
              className={`${btnOutline} !px-4 !py-2 text-xs inline-flex items-center gap-1.5`}
              type="button"
              disabled={reportBusy || analysisBusy}
              onClick={() => void handleReport()}
            >
              <LuFileText className="h-3.5 w-3.5" aria-hidden />
              {reportBusy ? 'Generating…' : 'Generate only'}
            </button>
          </div>

          <div className="grid lg:grid-cols-[1fr_240px]">
            <div className="border-b border-zinc-100 p-4 dark:border-zinc-800 md:p-5 lg:border-b-0 lg:border-r">
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
                  <ReportBody content={shownReport.content} />
                </div>
              ) : (
                <EmptyPanel
                  title="No report selected"
                  detail="Generate a full coach report, or pick one from history on the right."
                  action={(
                    <button
                      type="button"
                      className={`${btnPrimary} mt-4 inline-flex items-center gap-2`}
                      disabled={analysisBusy}
                      onClick={() => void handleGetAnalysis()}
                    >
                      <LuSparkles className="h-4 w-4" aria-hidden />
                      Get analysis
                    </button>
                  )}
                />
              )}
            </div>

            <aside className="bg-zinc-50/70 p-4 dark:bg-zinc-950/40 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  History
                </h4>
                {historyBusy ? <span className="text-[11px] text-zinc-400">Loading…</span> : null}
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500">No saved reports yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((row) => {
                    const selected = selectedHistoryId === row.id;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                            selected
                              ? 'bg-white shadow-sm ring-1 ring-violet-200 dark:bg-zinc-900 dark:ring-violet-800'
                              : 'hover:bg-white/80 dark:hover:bg-zinc-900/80'
                          }`}
                          onClick={() => {
                            setSelectedHistoryId(row.id);
                            setReport(row);
                          }}
                        >
                          <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {row.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-zinc-400 dark:text-zinc-500">
                            {row.created_at ? new Date(row.created_at).toLocaleDateString() : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          </div>
        </section>
      )}

      {activeSection === 'chat' && (
        <section className={`${card} overflow-hidden`} role="tabpanel" aria-label="Chat">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-800 md:px-5">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chat</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Temporary session for this account and date range.
              </p>
            </div>
            <button
              className={btnGhost}
              type="button"
              onClick={() => {
                setMessages([]);
                setChatError('');
              }}
            >
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
      )}

      <AnalysisProgressModal
        open={analysisOpen}
        percent={analysisPercent}
        label={analysisLabel}
      />
    </div>
  );
}
