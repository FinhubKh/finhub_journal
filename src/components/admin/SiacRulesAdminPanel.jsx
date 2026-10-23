import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { adminUpdateSiacRuleConfig, fetchSiacRuleConfig } from '../../api/siac';
import {
  DEFAULT_SIAC_CONFIG,
  RISK_RULE_IDS,
  customMetricOptions,
  mergeSiacConfig,
} from '../../lib/riskEligibility';
import { formulaVarOptions, validateFormula } from '../../lib/siacFormula';
import CustomDropdown from '../common/CustomDropdown';
import {
  btnDanger, btnGhost, btnOutline, btnPrimary, card, cardHd, cardTitle,
  emptyState, input, label, msgError, select, tableTd, tableTh,
} from '../../lib/ui';

const BUILTIN = [
  {
    id: RISK_RULE_IDS.HISTORY,
    name: 'Trading history',
    field: 'history_days_min',
    fieldKind: 'int',
    unit: 'days',
    tracks: 'both',
  },
  {
    id: RISK_RULE_IDS.DAILY,
    name: 'Max daily loss',
    field: 'daily_loss_max_pct',
    fieldKind: 'pct',
    unit: '%',
    tracks: 'both',
  },
  {
    id: RISK_RULE_IDS.OVERALL,
    name: 'Max overall loss',
    field: 'overall_loss_max_pct',
    fieldKind: 'pct',
    unit: '%',
    tracks: 'both',
  },
  {
    id: RISK_RULE_IDS.DD,
    name: 'Max drawdown',
    field: 'max_dd_max_pct',
    fieldKind: 'pct',
    unit: '%',
    tracks: 'both',
  },
  {
    id: RISK_RULE_IDS.RISK_TRADE,
    name: 'Risk per trade',
    field: 'risk_per_trade_max_pct',
    fieldKind: 'pct',
    unit: '%',
    tracks: 'both',
  },
  {
    id: RISK_RULE_IDS.STREAK,
    name: 'Losing streak',
    field: 'losing_streak_max',
    fieldKind: 'int',
    unit: 'losses',
    tracks: 'master',
  },
  {
    id: RISK_RULE_IDS.PERF,
    name: 'Performance report',
    field: null,
    fieldKind: null,
    unit: null,
    tracks: 'ea',
  },
];

const METRIC_OPTIONS = customMetricOptions();

const TRACK_OPTIONS = [
  { value: 'both', label: 'Master + EA' },
  { value: 'master', label: 'Master only' },
  { value: 'ea', label: 'EA only' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'close', label: 'Close' },
];

const formSelectBtn = `${select} inline-flex items-center justify-between gap-2 text-left font-normal`;
const tableSelectBtn = `${select} inline-flex min-w-[7.5rem] items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold`;

function statusFromEnabled(enabled) {
  return enabled === false ? 'close' : 'active';
}

function enabledFromStatus(status) {
  return status !== 'close';
}

function pctToInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Number((n * 100).toFixed(4)));
}

function inputToPct(value, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (allowZero ? n < 0 : n <= 0) return null;
  if (n > 1000) return null;
  return n / 100;
}

function operatorLabel(op) {
  return op === 'lte' ? 'At most' : 'At least';
}

function metricOptionLabel(opt) {
  if (!opt?.group || opt.value === 'guideline') return opt?.label || '';
  return `${opt.group} · ${opt.label}`;
}

function newCustomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `custom_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `custom_${Date.now().toString(36)}`;
}

function trackLabel(value) {
  return TRACK_OPTIONS.find((t) => t.value === value)?.label || value;
}

function metricLabel(value) {
  return METRIC_OPTIONS.find((m) => m.value === value)?.label || value;
}

function defaultLimitInput(metric) {
  const meta = METRIC_OPTIONS.find((m) => m.value === metric);
  if (!meta?.kind) return '';
  if (meta.kind === 'pct') return pctToInput(meta.defaultLimit ?? 0.01);
  if (meta.kind === 'num') return String(meta.defaultLimit ?? 1);
  return String(meta.defaultLimit ?? 1);
}

function defaultOperator(metric) {
  return METRIC_OPTIONS.find((m) => m.value === metric)?.defaultOp || 'gte';
}

const FORMULA_VAR_OPTIONS = formulaVarOptions();

function emptyForm() {
  return {
    name: '',
    tracks: 'both',
    metric: 'guideline',
    operator: 'gte',
    limitInput: '',
    limitText: '',
    formula: '',
    enabled: true,
  };
}

function SegmentedControl({ value, onChange, options, ariaLabel }) {
  return (
    <div className="inline-flex w-full rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active
                ? opt.tone === 'success'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-400'
                  : opt.tone === 'danger'
                    ? 'bg-white text-rose-700 shadow-sm dark:bg-zinc-800 dark:text-rose-400'
                    : 'bg-white text-violet-700 shadow-sm dark:bg-zinc-800 dark:text-violet-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AddRuleModal({ open, onClose, onAdd, existingTypes }) {
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setForm(emptyForm());
    setFormError(null);
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const meta = METRIC_OPTIONS.find((m) => m.value === form.metric) || METRIC_OPTIONS[METRIC_OPTIONS.length - 1];
  const templates = [
    ...METRIC_OPTIONS.filter((m) => m.value !== 'guideline').map((m) => ({
      key: `metric:${m.value}`,
      name: m.label.replace(/\s*\([^)]*\)\s*$/, ''),
      metric: m.value,
    })),
    ...(existingTypes || []).map((t) => ({
      key: `custom:${t.name}`,
      name: t.name,
      metric: t.metric || 'guideline',
    })),
  ];

  function applyTemplate(template) {
    setForm((prev) => ({
      ...prev,
      name: template.name,
      metric: template.metric,
      operator: defaultOperator(template.metric),
      limitInput: defaultLimitInput(template.metric),
      limitText: '',
      formula: template.metric === 'formula' ? (prev.formula || 'win_rate * 100') : '',
    }));
    setFormError(null);
  }

  function setMetric(metric) {
    const nextMeta = METRIC_OPTIONS.find((m) => m.value === metric);
    setForm((prev) => ({
      ...prev,
      metric,
      operator: defaultOperator(metric),
      name: prev.name.trim() ? prev.name : (nextMeta?.label.replace(/\s*\([^)]*\)\s*$/, '') || prev.name),
      limitInput: defaultLimitInput(metric),
      limitText: '',
      formula: metric === 'formula' ? (prev.formula || 'win_rate * 100') : '',
    }));
    setFormError(null);
  }

  function insertFormulaVar(name) {
    setForm((prev) => {
      const base = prev.formula?.trim() ? `${prev.formula.trim()} ` : '';
      return { ...prev, formula: `${base}${name}` };
    });
    setFormError(null);
  }

  function handleSubmit(e) {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setFormError('Rule name is required.');
      return;
    }

    const metric = form.metric || 'guideline';
    const scoreMeta = METRIC_OPTIONS.find((m) => m.value === metric) || METRIC_OPTIONS[METRIC_OPTIONS.length - 1];
    const fixedOp = scoreMeta.special === 'breaches' || scoreMeta.special === 'streak';
    const operator = fixedOp
      ? (scoreMeta.defaultOp || 'lte')
      : (form.operator === 'lte' ? 'lte' : 'gte');

    let limit = null;
    let limit_text = '';
    let formula = '';
    if (metric === 'formula') {
      const checked = validateFormula(form.formula);
      if (!checked.ok) {
        setFormError(checked.error);
        return;
      }
      formula = checked.formula;
      const n = Number(form.limitInput);
      if (!Number.isFinite(n)) {
        setFormError('Enter a valid threshold number.');
        return;
      }
      limit = n;
    } else if (scoreMeta.kind === 'pct') {
      limit = inputToPct(form.limitInput, { allowZero: metric === 'win_rate' || metric === 'total_pnl_pct' });
      if (limit == null) {
        setFormError('Enter a valid percentage limit.');
        return;
      }
    } else if (scoreMeta.kind === 'int') {
      const n = Number.parseInt(form.limitInput, 10);
      if (!Number.isFinite(n) || n < 1) {
        setFormError('Enter a valid limit (1 or higher).');
        return;
      }
      limit = n;
    } else if (scoreMeta.kind === 'num') {
      const n = Number(form.limitInput);
      if (!Number.isFinite(n) || n <= 0) {
        setFormError('Enter a valid number (greater than 0).');
        return;
      }
      limit = n;
    } else {
      limit_text = form.limitText.trim();
    }

    onAdd({
      id: newCustomId(),
      type_name: name,
      label: name,
      enabled: form.enabled !== false,
      tracks: form.tracks,
      metric,
      operator,
      limit,
      limit_text,
      formula,
    });
    onClose();
  }

  const isFormula = form.metric === 'formula';
  const previewName = form.name.trim() || 'New rule';
  const previewLimit = !meta?.kind
    ? (form.limitText.trim() || 'Guideline')
    : isFormula
      ? `${form.formula.trim() || '…'} ${form.operator === 'lte' ? '≤' : '≥'} ${form.limitInput || '—'}`
      : meta.kind === 'pct'
        ? `${operatorLabel(form.operator)} ${form.limitInput || '—'}%`
        : `${operatorLabel(form.operator)} ${form.limitInput || '—'} ${meta.unit || ''}`.trim();
  const showOperator = Boolean(meta?.kind && meta.special !== 'breaches' && meta.special !== 'streak');

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${card} flex max-h-[min(90vh,40rem)] w-full max-w-xl flex-col overflow-hidden shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-siac-rule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
              SIAC
            </p>
            <h3 id="add-siac-rule-title" className="mt-0.5 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Add rule
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Name it, choose how it scores, then set the limit.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={onClose}
            aria-label="Close"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {formError ? (
              <p className={`${msgError} rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/30`}>
                {formError}
              </p>
            ) : null}

            {templates.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Quick start — pick a score metric
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                      onClick={() => applyTemplate(t)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <label className={label} htmlFor="add-rule-name">Rule name</label>
              <input
                id="add-rule-name"
                className={input}
                placeholder="e.g. Max weekly loss"
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  setFormError(null);
                }}
                autoFocus
              />
            </div>

            <div>
              <label className={label}>How it scores</label>
              <CustomDropdown
                className="w-full"
                menuClassName="w-full"
                buttonClassName={formSelectBtn}
                value={form.metric}
                onChange={setMetric}
                options={METRIC_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: metricOptionLabel(opt),
                }))}
                ariaLabel="How it scores"
              />
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                {isFormula
                  ? 'Write an expression over journal metrics. Result is compared with Pass when + threshold.'
                  : meta?.kind
                    ? 'Scored from the trader journal. Set Pass when (at least / at most) and the threshold.'
                    : 'Guideline only — shown on checklists, not auto-scored.'}
              </p>
            </div>

            {isFormula ? (
              <div>
                <label className={label} htmlFor="add-rule-formula">Formula</label>
                <textarea
                  id="add-rule-formula"
                  className={`${input} min-h-[4.5rem] resize-y font-mono text-sm`}
                  placeholder="e.g. win_rate * 100"
                  value={form.formula}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, formula: e.target.value }));
                    setFormError(null);
                  }}
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Numbers, + − × ÷, parentheses, and metric names only.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {FORMULA_VAR_OPTIONS.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      title={v.label}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                      onClick={() => insertFormulaVar(v.value)}
                    >
                      {v.value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {showOperator ? (
                <div className="sm:col-span-2">
                  <label className={label}>Pass when</label>
                  <div className="max-w-sm">
                    <SegmentedControl
                      value={form.operator === 'lte' ? 'lte' : 'gte'}
                      onChange={(v) => setForm((prev) => ({ ...prev, operator: v }))}
                      options={[
                        { value: 'gte', label: 'At least (≥)' },
                        { value: 'lte', label: 'At most (≤)' },
                      ]}
                      ariaLabel="Pass when"
                    />
                  </div>
                </div>
              ) : null}

              {meta?.kind ? (
                <div>
                  <label className={label} htmlFor="add-rule-limit">
                    {showOperator ? 'Threshold' : 'Limit'}
                  </label>
                  <div className="relative">
                    <input
                      id="add-rule-limit"
                      className={`${input} ${meta.unit ? 'pr-14' : ''}`}
                      type="number"
                      min={isFormula ? undefined : meta.kind === 'pct' ? 0 : meta.kind === 'num' ? 0.01 : 1}
                      step={isFormula || meta.kind === 'num' ? 0.1 : meta.kind === 'pct' ? 0.01 : 1}
                      value={form.limitInput}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, limitInput: e.target.value }));
                        setFormError(null);
                      }}
                      placeholder={isFormula ? '55' : meta.kind === 'pct' ? '50' : meta.kind === 'num' ? '1.2' : '1'}
                    />
                    {meta.unit ? (
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-zinc-400">
                        {meta.unit}
                      </span>
                    ) : null}
                  </div>
                  {meta.special === 'breaches' ? (
                    <p className="mt-1 text-xs text-zinc-400">Fails if any trade risks more than this %.</p>
                  ) : null}
                  {meta.special === 'streak' ? (
                    <p className="mt-1 text-xs text-zinc-400">Fails if a losing streak of this length appears.</p>
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className={label} htmlFor="add-rule-note">
                    Note <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <input
                    id="add-rule-note"
                    className={input}
                    placeholder="Shown next to the rule"
                    value={form.limitText}
                    onChange={(e) => setForm((prev) => ({ ...prev, limitText: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className={label}>Applies to</label>
                <SegmentedControl
                  value={form.tracks}
                  onChange={(v) => setForm((prev) => ({ ...prev, tracks: v }))}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'master', label: 'Master' },
                    { value: 'ea', label: 'EA' },
                  ]}
                  ariaLabel="Applies to"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Status</label>
                <div className="max-w-xs">
                  <SegmentedControl
                    value={statusFromEnabled(form.enabled)}
                    onChange={(v) => setForm((prev) => ({ ...prev, enabled: enabledFromStatus(v) }))}
                    options={[
                      { value: 'active', label: 'Active', tone: 'success' },
                      { value: 'close', label: 'Close', tone: 'danger' },
                    ]}
                    ariaLabel="Rule status"
                  />
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                Preview
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100">
                  {previewName}
                </span>
                <span className="rounded-md bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {trackLabel(form.tracks)}
                </span>
                <span className="rounded-md bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {previewLimit}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  form.enabled !== false
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                }`}
                >
                  {form.enabled !== false ? 'Active' : 'Close'}
                </span>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-zinc-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Click Save on the rules page after adding.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className={btnGhost} type="button" onClick={onClose}>
                Cancel
              </button>
              <button className={btnPrimary} type="submit">
                <LuPlus className="h-4 w-4" />
                Add rule
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function SiacRulesAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(() => mergeSiacConfig(DEFAULT_SIAC_CONFIG));
  const [addOpen, setAddOpen] = useState(false);
  const [headerTarget, setHeaderTarget] = useState(() =>
    typeof document !== 'undefined' ? document.getElementById('siac-header-actions') : null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cfg = await fetchSiacRuleConfig();
        if (!cancelled) setDraft(cfg);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load SIAC rules.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!headerTarget && typeof document !== 'undefined') {
      const el = document.getElementById('siac-header-actions');
      if (el) setHeaderTarget(el);
    }
  }, [headerTarget]);

  function setEnabled(id, enabled) {
    setDraft((prev) => ({
      ...prev,
      enabled_rules: { ...prev.enabled_rules, [id]: enabled },
    }));
  }

  function setLabel(id, text) {
    setDraft((prev) => ({
      ...prev,
      rule_labels: { ...prev.rule_labels, [id]: text },
    }));
  }

  function setLimit(field, kind, raw) {
    setDraft((prev) => {
      if (kind === 'pct') {
        const pct = inputToPct(raw);
        if (pct == null) return prev;
        return { ...prev, [field]: pct };
      }
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1) return prev;
      return { ...prev, [field]: n };
    });
  }

  function addCustomRule(row) {
    setDraft((prev) => ({
      ...prev,
      custom_rules: [...(prev.custom_rules || []), row],
    }));
  }

  function updateCustom(id, patch) {
    setDraft((prev) => ({
      ...prev,
      custom_rules: (prev.custom_rules || []).map((row) => (
        row.id === id ? { ...row, ...patch } : row
      )),
    }));
  }

  function removeCustom(id) {
    setDraft((prev) => ({
      ...prev,
      custom_rules: (prev.custom_rules || []).filter((row) => row.id !== id),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const customs = (draft.custom_rules || []).map((row) => {
        const metric = row.metric || 'guideline';
        const formula = metric === 'formula' ? String(row.formula || '').trim() : '';
        if (metric === 'formula') {
          const checked = validateFormula(formula);
          if (!checked.ok) {
            throw new Error(`${row.label || 'Formula rule'}: ${checked.error}`);
          }
        }
        return {
          id: String(row.id),
          type_name: String(row.type_name || row.label || 'Custom rule').trim(),
          label: String(row.label || '').trim() || 'Custom rule',
          enabled: row.enabled !== false,
          tracks: ['both', 'master', 'ea'].includes(row.tracks) ? row.tracks : 'both',
          metric,
          operator: row.operator === 'lte' ? 'lte' : 'gte',
          limit: metric === 'guideline' || row.limit == null ? null : Number(row.limit),
          limit_text: String(row.limit_text || '').trim(),
          formula,
        };
      });
      const saved = await adminUpdateSiacRuleConfig({
        history_days_min: draft.history_days_min,
        daily_loss_max_pct: draft.daily_loss_max_pct,
        overall_loss_max_pct: draft.overall_loss_max_pct,
        max_dd_max_pct: draft.max_dd_max_pct,
        risk_per_trade_max_pct: draft.risk_per_trade_max_pct,
        losing_streak_max: draft.losing_streak_max,
        enabled_rules: draft.enabled_rules,
        rule_labels: draft.rule_labels,
        custom_rules: customs,
      });
      setDraft(saved);
      toast.success('SIAC rules saved. All tracked accounts were re-scored.');
    } catch (e) {
      setError(e.message || 'Could not save SIAC rules.');
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className={`${emptyState} flex-1`}>Loading SIAC rules…</div>;
  }

  const customs = draft.custom_rules || [];
  const existingTypes = (() => {
    const map = new Map();
    for (const row of customs) {
      const name = String(row.type_name || '').trim();
      if (!name) continue;
      if (!map.has(name)) {
        map.set(name, { name, metric: row.metric || 'guideline' });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  const actionButtons = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button
        className={`${btnOutline} gap-1.5 px-3.5 py-2 text-sm`}
        type="button"
        onClick={() => setAddOpen(true)}
      >
        <LuPlus className="h-4 w-4" />
        Add rule
      </button>
      <button
        className={`${btnPrimary} px-4 py-2 text-sm`}
        type="button"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );

  return (
    <>
      {headerTarget ? createPortal(actionButtons, headerTarget) : null}
      <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>

      <div className="min-h-0 flex-1 overflow-auto">
        {error && <p className={`${msgError} px-4 pt-3`}>{error}</p>}
        {draft.updated_at && (
          <p className="px-4 pt-3 text-xs text-zinc-400 dark:text-zinc-500">
            Last updated {new Date(draft.updated_at).toLocaleString()}
          </p>
        )}

        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={tableTh}>Rule</th>
              <th className={tableTh}>Applies to</th>
              <th className={tableTh}>Display label</th>
              <th className={tableTh}>Limit</th>
              <th className={tableTh}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {BUILTIN.map((rule) => {
              const enabled = draft.enabled_rules?.[rule.id] !== false;
              const labelText = draft.rule_labels?.[rule.id] || '';
              let fieldValue = '';
              if (rule.field) {
                fieldValue = rule.fieldKind === 'pct'
                  ? pctToInput(draft[rule.field])
                  : String(draft[rule.field] ?? '');
              }
              return (
                <tr key={rule.id} className={!enabled ? 'opacity-55' : undefined}>
                  <td className={tableTd}>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{rule.name}</div>
                    <div className="text-[11px] text-zinc-400">Core · {rule.id}</div>
                  </td>
                  <td className={tableTd}>
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{trackLabel(rule.tracks)}</span>
                  </td>
                  <td className={tableTd}>
                    <input
                      className={`${input} min-w-[14rem]`}
                      value={labelText}
                      onChange={(e) => setLabel(rule.id, e.target.value)}
                    />
                  </td>
                  <td className={tableTd}>
                    {rule.field ? (
                      <div className="flex items-center gap-2">
                        <input
                          className={`${input} w-28`}
                          type="number"
                          min={rule.fieldKind === 'pct' ? 0.01 : 1}
                          step={rule.fieldKind === 'pct' ? 0.01 : 1}
                          value={fieldValue}
                          onChange={(e) => setLimit(rule.field, rule.fieldKind, e.target.value)}
                        />
                        <span className="text-xs text-zinc-400">{rule.unit}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400">Auto</span>
                    )}
                  </td>
                  <td className={tableTd}>
                    <CustomDropdown
                      className="w-[8.5rem]"
                      menuClassName="w-36"
                      buttonClassName={tableSelectBtn}
                      value={statusFromEnabled(enabled)}
                      onChange={(v) => setEnabled(rule.id, enabledFromStatus(v))}
                      options={STATUS_OPTIONS}
                      ariaLabel={`${rule.name} status`}
                    />
                  </td>
                </tr>
              );
            })}

            {customs.map((row) => {
              const meta = METRIC_OPTIONS.find((m) => m.value === row.metric) || METRIC_OPTIONS[METRIC_OPTIONS.length - 1];
              const typeName = row.type_name || metricLabel(row.metric);
              const op = row.operator === 'lte' ? '≤' : '≥';
              const isFormulaRow = row.metric === 'formula';
              const showOpHint = meta.kind && meta.special !== 'breaches' && meta.special !== 'streak';
              const limitDisplay = !meta.kind
                ? (row.limit_text || '—')
                : isFormulaRow
                  ? `${row.formula || '…'} ${op} ${row.limit ?? '—'}`
                  : meta.kind === 'pct'
                    ? `${meta.special ? '' : `${op} `}${pctToInput(row.limit)}%`
                    : meta.kind === 'num'
                      ? `${op} ${row.limit ?? '—'} ${meta.unit}`
                      : `${meta.special ? '' : `${op} `}${row.limit ?? '—'} ${meta.unit}`;
              return (
                <tr key={row.id} className={row.enabled === false ? 'opacity-55' : undefined}>
                  <td className={tableTd}>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{typeName}</div>
                    <div className="text-[11px] text-zinc-400">
                      Custom · {metricLabel(row.metric)}
                      {showOpHint ? ` · ${operatorLabel(row.operator || meta.defaultOp)}` : ''}
                      {isFormulaRow && row.formula ? ` · ${row.formula}` : ''}
                    </div>
                    <button
                      type="button"
                      className={`${btnDanger} mt-2 !px-2.5 !py-1.5 text-xs`}
                      onClick={() => removeCustom(row.id)}
                      title="Remove rule"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </td>
                  <td className={tableTd}>
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{trackLabel(row.tracks)}</span>
                  </td>
                  <td className={tableTd}>
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">{row.label}</span>
                  </td>
                  <td className={tableTd}>
                    <span className="tabular-nums text-sm text-zinc-600 dark:text-zinc-300">{limitDisplay}</span>
                  </td>
                  <td className={tableTd}>
                    <CustomDropdown
                      className="w-[8.5rem]"
                      menuClassName="w-36"
                      buttonClassName={tableSelectBtn}
                      value={statusFromEnabled(row.enabled !== false)}
                      onChange={(v) => updateCustom(row.id, { enabled: enabledFromStatus(v) })}
                      options={STATUS_OPTIONS}
                      ariaLabel={`${row.label || typeName} status`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddRuleModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addCustomRule}
        existingTypes={existingTypes}
      />
    </section>
    </>
  );
}
