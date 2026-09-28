import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { adminUpdateSiacRuleConfig, fetchSiacRuleConfig } from '../../api/siac';
import { DEFAULT_SIAC_CONFIG, RISK_RULE_IDS, mergeSiacConfig } from '../../lib/riskEligibility';
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

const METRIC_OPTIONS = [
  { value: 'history_days', label: 'Trading history (days)', kind: 'int', unit: 'days' },
  { value: 'daily_loss_pct', label: 'Max daily loss (%)', kind: 'pct', unit: '%' },
  { value: 'overall_loss_pct', label: 'Max overall loss (%)', kind: 'pct', unit: '%' },
  { value: 'max_dd_pct', label: 'Max drawdown (%)', kind: 'pct', unit: '%' },
  { value: 'risk_per_trade_pct', label: 'Risk per trade (%)', kind: 'pct', unit: '%' },
  { value: 'losing_streak', label: 'Losing streak (count)', kind: 'int', unit: 'losses' },
  { value: 'guideline', label: 'Guideline (display only)', kind: null, unit: null },
];

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

function inputToPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / 100;
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

function emptyForm() {
  return {
    typeMode: 'create', // 'existing' | 'create'
    existingKey: 'history_days',
    typeName: '',
    label: '',
    tracks: 'both',
    metric: 'guideline',
    limitInput: '',
    limitText: '',
    enabled: true,
  };
}

function AddRuleModal({ open, onClose, onAdd, existingTypes }) {
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);

  const typeOptions = [
    ...METRIC_OPTIONS.map((opt) => ({
      key: `metric:${opt.value}`,
      name: opt.label,
      metric: opt.value,
      kind: 'builtin',
    })),
    ...(existingTypes || []).map((t) => ({
      key: `custom:${t.name}`,
      name: t.name,
      metric: t.metric || 'guideline',
      kind: 'custom',
    })),
  ];

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

  const activeMetric = form.typeMode === 'existing'
    ? (typeOptions.find((t) => t.key === form.existingKey)?.metric || form.metric)
    : form.metric;
  const meta = METRIC_OPTIONS.find((m) => m.value === activeMetric) || METRIC_OPTIONS.find((m) => m.value === 'guideline');

  function applyExisting(key) {
    const opt = typeOptions.find((t) => t.key === key);
    const metric = opt?.metric || 'guideline';
    const next = METRIC_OPTIONS.find((m) => m.value === metric);
    setForm((prev) => ({
      ...prev,
      typeMode: 'existing',
      existingKey: key,
      typeName: opt?.kind === 'custom' ? opt.name : '',
      metric,
      label: prev.label || (opt?.kind === 'custom' ? opt.name : ''),
      limitInput: next?.kind === 'pct' ? '1' : next?.kind === 'int' ? (metric === 'history_days' ? '182' : '3') : '',
      limitText: '',
    }));
  }

  function setScoreMetric(metric) {
    const next = METRIC_OPTIONS.find((m) => m.value === metric);
    setForm((prev) => ({
      ...prev,
      metric,
      limitInput: next?.kind === 'pct' ? '1' : next?.kind === 'int' ? (metric === 'history_days' ? '182' : '3') : '',
      limitText: '',
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    let typeName = '';
    let metric = activeMetric;

    if (form.typeMode === 'create') {
      typeName = form.typeName.trim();
      if (!typeName) {
        setFormError('Rule type name is required.');
        return;
      }
      metric = form.metric || 'guideline';
    } else {
      const opt = typeOptions.find((t) => t.key === form.existingKey);
      typeName = opt?.kind === 'custom' ? opt.name : (opt?.name || metricLabel(metric));
      metric = opt?.metric || form.metric || 'guideline';
    }

    const labelText = form.label.trim() || typeName;
    const scoreMeta = METRIC_OPTIONS.find((m) => m.value === metric) || METRIC_OPTIONS[METRIC_OPTIONS.length - 1];

    let limit = null;
    let limit_text = '';
    if (scoreMeta.kind === 'pct') {
      limit = inputToPct(form.limitInput);
      if (limit == null) {
        setFormError('Enter a valid limit percentage.');
        return;
      }
    } else if (scoreMeta.kind === 'int') {
      const n = Number.parseInt(form.limitInput, 10);
      if (!Number.isFinite(n) || n < 1) {
        setFormError('Enter a valid limit (1 or higher).');
        return;
      }
      limit = n;
    } else {
      limit_text = form.limitText.trim();
    }

    onAdd({
      id: newCustomId(),
      type_name: typeName,
      label: labelText,
      enabled: form.enabled !== false,
      tracks: form.tracks,
      metric,
      limit,
      limit_text,
    });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${card} w-full max-w-lg shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-siac-rule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h3 id="add-siac-rule-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Add SIAC rule
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Pick an existing type or create a new rule type.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={onClose}
            aria-label="Close"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          {formError && <p className={msgError}>{formError}</p>}

          <div>
            <div className={label}>Rule type</div>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  form.typeMode === 'create'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
                onClick={() => setForm((prev) => ({
                  ...prev,
                  typeMode: 'create',
                  metric: prev.metric || 'guideline',
                  limitInput: '',
                  limitText: '',
                }))}
              >
                Create new type
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  form.typeMode === 'existing'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
                onClick={() => applyExisting(form.existingKey || 'metric:history_days')}
              >
                Use existing
              </button>
            </div>

            {form.typeMode === 'create' ? (
              <div className="space-y-3">
                <div>
                  <label className={label} htmlFor="add-rule-type-name">Type name</label>
                  <input
                    id="add-rule-type-name"
                    className={input}
                    placeholder="e.g. Max weekly loss"
                    value={form.typeName}
                    onChange={(e) => setForm((prev) => ({
                      ...prev,
                      typeName: e.target.value,
                      label: prev.label || e.target.value,
                    }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className={label}>Score using</label>
                  <CustomDropdown
                    className="w-full"
                    menuClassName="w-full"
                    buttonClassName={formSelectBtn}
                    value={form.metric}
                    onChange={setScoreMetric}
                    options={METRIC_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                    ariaLabel="Score using"
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Choose how this type is checked, or Guideline for display-only.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className={label}>Existing type</label>
                <CustomDropdown
                  className="w-full"
                  menuClassName="w-full"
                  buttonClassName={formSelectBtn}
                  value={form.existingKey}
                  onChange={applyExisting}
                  options={[
                    ...METRIC_OPTIONS.map((opt) => ({
                      value: `metric:${opt.value}`,
                      label: opt.label,
                    })),
                    ...(existingTypes || []).map((t) => ({
                      value: `custom:${t.name}`,
                      label: t.name,
                    })),
                  ]}
                  ariaLabel="Existing type"
                />
              </div>
            )}
          </div>

          <div>
            <label className={label}>Applies to</label>
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              buttonClassName={formSelectBtn}
              value={form.tracks}
              onChange={(v) => setForm((prev) => ({ ...prev, tracks: v }))}
              options={TRACK_OPTIONS}
              ariaLabel="Applies to"
            />
          </div>

          <div>
            <label className={label} htmlFor="add-rule-label">Display label</label>
            <input
              id="add-rule-label"
              className={input}
              placeholder="Shown on trader checklists"
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
            />
          </div>

          {meta?.kind ? (
            <div>
              <label className={label} htmlFor="add-rule-limit">
                Limit ({meta.unit})
              </label>
              <input
                id="add-rule-limit"
                className={input}
                type="number"
                min={meta.kind === 'pct' ? 0.01 : 1}
                step={meta.kind === 'pct' ? 0.01 : 1}
                value={form.limitInput}
                onChange={(e) => setForm((prev) => ({ ...prev, limitInput: e.target.value }))}
              />
            </div>
          ) : (
            <div>
              <label className={label} htmlFor="add-rule-note">Limit note (optional)</label>
              <input
                id="add-rule-note"
                className={input}
                placeholder="Shown next to the rule on checklists"
                value={form.limitText}
                onChange={(e) => setForm((prev) => ({ ...prev, limitText: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label className={label}>Status</label>
            <CustomDropdown
              className="w-full"
              menuClassName="w-full"
              buttonClassName={formSelectBtn}
              value={statusFromEnabled(form.enabled)}
              onChange={(v) => setForm((prev) => ({ ...prev, enabled: enabledFromStatus(v) }))}
              options={STATUS_OPTIONS}
              ariaLabel="Rule status"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end dark:border-zinc-800">
            <button className={btnGhost} type="button" onClick={onClose}>
              Cancel
            </button>
            <button className={btnPrimary} type="submit">
              <LuPlus className="h-4 w-4" />
              Add rule
            </button>
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
      const customs = (draft.custom_rules || []).map((row) => ({
        id: String(row.id),
        type_name: String(row.type_name || row.label || 'Custom rule').trim(),
        label: String(row.label || '').trim() || 'Custom rule',
        enabled: row.enabled !== false,
        tracks: ['both', 'master', 'ea'].includes(row.tracks) ? row.tracks : 'both',
        metric: row.metric || 'guideline',
        limit: row.metric === 'guideline' || row.limit == null ? null : Number(row.limit),
        limit_text: String(row.limit_text || '').trim(),
      }));
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
              const limitDisplay = meta.kind === 'pct'
                ? `${pctToInput(row.limit)}%`
                : meta.kind === 'int'
                  ? `${row.limit ?? '—'} ${meta.unit}`
                  : (row.limit_text || '—');
              return (
                <tr key={row.id} className={row.enabled === false ? 'opacity-55' : undefined}>
                  <td className={tableTd}>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{typeName}</div>
                    <div className="text-[11px] text-zinc-400">
                      Custom · scores via {metricLabel(row.metric)}
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
