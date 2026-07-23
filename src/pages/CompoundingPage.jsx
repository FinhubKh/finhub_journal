import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  deleteCompoundingAccount,
  fetchCompoundingAccounts,
  insertCompoundingAccount,
} from '../api/compounding';
import { fetchTradingAccounts } from '../api';
import { useDialog } from '../context/DialogContext';
import { DEFAULT_CONFIG } from '../lib/compounding/types';
import { formatMoney } from '../lib/compounding/formatMoney';
import { tradesNeededToTarget } from '../lib/compounding/projection';
import { accountToConfig } from '../lib/compounding/account';
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  cardBody,
  dashboardPageWide,
  emptyState,
  input,
  label,
} from '../lib/ui';
import CustomDropdown from '../components/common/CustomDropdown';
import CompoundingAccountView from '../components/compounding/CompoundingAccountView';
import { ModalActions, PlanModalShell } from '../components/compounding/CompoundingUI';
import GrowthScheduleSimulator from '../components/compounding/GrowthScheduleSimulator';
import { pillBtn, pillToggle } from '../lib/ui';

const EMPTY_FORM = {
  name: '',
  startingBalance: String(DEFAULT_CONFIG.startingBalance),
  targetBalance: String(DEFAULT_CONFIG.targetBalance),
  targetProfitPercent: String(DEFAULT_CONFIG.targetProfitPercent),
  riskPercent: String(DEFAULT_CONFIG.riskPercent),
  tradingAccountId: '',
};

function PlanCard({ account, linkedName, onOpen, onDelete }) {
  const config = accountToConfig(account);
  const winsNeeded = tradesNeededToTarget(config);

  const startVal = Number(account.startingBalance) || 100;
  const targetVal = Number(account.targetBalance) || 1000;
  const multiple = startVal > 0 ? targetVal / startVal : 1;
  const percentGain = startVal > 0 ? ((targetVal - startVal) / startVal) * 100 : 0;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:border-violet-500/40">
      {/* Top Accent Gradient Border Glow on Hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header Info */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
            {config.timeHorizon ? `${config.timeHorizon} Weeks Plan` : 'Compounding Plan'}
          </span>

          {account.tradingAccountId ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {linkedName || 'Linked Account'}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">Standalone</span>
          )}
        </div>

        {/* Plan Title */}
        <h2 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
          {account.name}
        </h2>

        {/* Growth Target Box */}
        <div className="mt-4 rounded-xl bg-zinc-50/80 p-4 border border-zinc-100 dark:bg-zinc-800/50 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span>Starting Capital</span>
            <span>Target Balance</span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatMoney(startVal)}
            </span>
            <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-lg font-bold text-violet-600 dark:text-violet-400">
              {formatMoney(targetVal)}
            </span>
          </div>
        </div>

        {/* Est Wins Badge */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-100/70 px-4 py-2.5 dark:bg-zinc-800/80">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Estimated Wins Needed</span>
          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
            ~{winsNeeded} trades
          </span>
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          onClick={onOpen}
        >
          Open Plan
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          className="rounded-xl border border-zinc-200 px-3 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          onClick={onDelete}
          title="Delete Plan"
        >
          <svg className="h-4 w-4 text-zinc-400 hover:text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CreatePlanModal({ tradingAccounts, initialData, onClose, onCreated }) {
  const [form, setForm] = useState(() => {
    const rawTarget = initialData?.targetBalance;
    const clampedTarget =
      rawTarget != null && Number.isFinite(Number(rawTarget))
        ? Math.min(999999999999, Math.max(0, Number(rawTarget)))
        : DEFAULT_CONFIG.targetBalance;
    const targetStr = Number.isFinite(clampedTarget)
      ? clampedTarget.toFixed(2)
      : String(DEFAULT_CONFIG.targetBalance);

    return {
      name: initialData?.name || '',
      startingBalance: initialData?.startingBalance ? String(initialData.startingBalance) : String(DEFAULT_CONFIG.startingBalance),
      targetBalance: targetStr,
      targetProfitPercent: initialData?.targetProfitPercent ? String(initialData.targetProfitPercent) : String(DEFAULT_CONFIG.targetProfitPercent),
      riskPercent: initialData?.riskPercent ? String(initialData.riskPercent) : String(DEFAULT_CONFIG.riskPercent),
      tradingAccountId: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const accountOptions = useMemo(
    () => [
      { value: '', label: 'None (standalone)' },
      ...tradingAccounts.map((a) => ({ value: a.id, label: a.name })),
    ],
    [tradingAccounts],
  );

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Enter a plan name');
      return;
    }
    const startingBalance = Number(form.startingBalance);
    const targetBalance = Number(form.targetBalance);
    const targetProfitPercent = Number(form.targetProfitPercent);
    const riskPercent = Number(form.riskPercent);
    if (!Number.isFinite(startingBalance) || startingBalance <= 0) {
      toast.error('Enter a valid starting capital');
      return;
    }
    if (!Number.isFinite(targetBalance) || targetBalance <= startingBalance) {
      toast.error('Target must be greater than starting capital');
      return;
    }
    if (targetBalance > 999999999999) {
      toast.error('Target balance exceeds maximum database limit ($999.9B)');
      return;
    }
    if (!Number.isFinite(targetProfitPercent) || targetProfitPercent <= 0 || targetProfitPercent > 100) {
      toast.error('Profit % must be between 0 and 100');
      return;
    }
    if (!Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100) {
      toast.error('Risk % must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      const created = await insertCompoundingAccount({
        name,
        startingBalance,
        targetBalance,
        targetProfitPercent,
        riskPercent,
        riskRewardRatio: DEFAULT_CONFIG.riskRewardRatio,
        stopLossPips: DEFAULT_CONFIG.stopLossPips,
        lotSizeMethod: DEFAULT_CONFIG.lotSizeMethod,
        pipValuePerLot: DEFAULT_CONFIG.pipValuePerLot,
        pointValuePerLot: DEFAULT_CONFIG.pointValuePerLot,
        plSource: 'calculated',
        tradingAccountId: form.tradingAccountId || null,
      });
      toast.success('Compounding plan created');
      onCreated(created);
    } catch (e) {
      toast.error(e?.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlanModalShell
      title="New compounding plan"
      subtitle="Capital, target balance, profit % per win, and risk % — generates your compound table."
      onClose={onClose}
      busy={saving}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void handleCreate()}
          busy={saving}
          confirmLabel="Create plan"
        />
      }
    >
      <div>
        <label className={label}>Plan name</label>
        <input
          className={input}
          placeholder="e.g. $20 to $20k challenge"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Starting capital</label>
          <input
            type="number"
            step="0.01"
            className={`${input} tabular-nums`}
            value={form.startingBalance}
            onChange={(e) => setField('startingBalance', e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Target balance</label>
          <input
            type="number"
            step="0.01"
            className={`${input} tabular-nums`}
            value={form.targetBalance}
            onChange={(e) => setField('targetBalance', e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Profit % per win</label>
          <input
            type="number"
            step="0.01"
            className={`${input} tabular-nums`}
            value={form.targetProfitPercent}
            onChange={(e) => setField('targetProfitPercent', e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Risk % per trade</label>
          <input
            type="number"
            step="0.01"
            className={`${input} tabular-nums`}
            value={form.riskPercent}
            onChange={(e) => setField('riskPercent', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={label}>Link trading account (optional)</label>
        <CustomDropdown
          className="w-full"
          menuClassName="w-full"
          value={form.tradingAccountId}
          onChange={(v) => {
            const linked = tradingAccounts.find((a) => a.id === v);
            setForm((prev) => ({
              ...prev,
              tradingAccountId: v,
              startingBalance:
                linked?.starting_balance != null && Number(linked.starting_balance) > 0
                  ? String(linked.starting_balance)
                  : prev.startingBalance,
            }));
          }}
          options={accountOptions}
        />
      </div>
    </PlanModalShell>
  );
}

export default function CompoundingPage() {
  const { confirm } = useDialog();
  const [accounts, setAccounts] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createInitialData, setCreateInitialData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [activeMainTab, setActiveMainTab] = useState('plans'); // 'plans' | 'simulator'

  const tradingNameById = useMemo(() => {
    const map = new Map();
    for (const a of tradingAccounts) map.set(a.id, a.name);
    return map;
  }, [tradingAccounts]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, trading] = await Promise.all([
        fetchCompoundingAccounts(),
        fetchTradingAccounts().catch(() => []),
      ]);
      setAccounts(list);
      setTradingAccounts(trading);
    } catch (e) {
      toast.error(e?.message || 'Failed to load compounding plans');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (selectedId) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain">
        <CompoundingAccountView
          accountId={selectedId}
          onBack={() => {
            setSelectedId(null);
            void reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain">
      <div className={dashboardPageWide}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Compounding Engine
              </h1>
              <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                Simulator & Strategy
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Build exponential growth plans, model multi-tier risk de-escalation schedules, and track compounding milestones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Main View Toggle */}
            <div className="inline-flex rounded-xl bg-zinc-100/80 p-1 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
              <button
                type="button"
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeMainTab === 'plans'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
                onClick={() => setActiveMainTab('plans')}
              >
                My Plans ({accounts.length})
              </button>
              <button
                type="button"
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeMainTab === 'simulator'
                    ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
                onClick={() => setActiveMainTab('simulator')}
              >
                Growth Schedule Simulator
              </button>
            </div>

            {activeMainTab === 'plans' && (
              <button
                type="button"
                className={`${btnPrimary} !py-2 !px-4 !text-xs font-semibold shadow-sm`}
                onClick={() => {
                  setCreateInitialData(null);
                  setShowCreate(true);
                }}
              >
                + New Plan
              </button>
            )}
          </div>
        </div>

        {activeMainTab === 'plans' ? (
          loading ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : accounts.length === 0 ? (
            <div className={`${card} ${emptyState}`}>
              No compounding plans yet. Create one or model a plan in the Growth Schedule Simulator.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <PlanCard
                  key={account.id}
                  account={account}
                  linkedName={tradingNameById.get(account.tradingAccountId)}
                  onOpen={() => setSelectedId(account.id)}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: 'Delete plan?',
                      message: `Delete “${account.name}” and all of its compounding trades?`,
                      confirmLabel: 'Delete',
                      destructive: true,
                    });
                    if (!ok) return;
                    try {
                      await deleteCompoundingAccount(account.id);
                      toast.success('Plan deleted');
                      await reload();
                    } catch (e) {
                      toast.error(e?.message || 'Delete failed');
                    }
                  }}
                />
              ))}

              {/* Quick Strategy Creation Card */}
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-zinc-300/80 bg-zinc-50/50 p-6 transition-all duration-300 hover:border-violet-400 hover:bg-violet-50/30 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-violet-500/40 min-h-[200px]">
                <div className="flex flex-1 flex-col items-center justify-center text-center py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100">Add Another Plan</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`${btnPrimary} flex-1 !text-xs !py-2.5`}
                    onClick={() => {
                      setCreateInitialData(null);
                      setShowCreate(true);
                    }}
                  >
                    + New Plan
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} flex-1 !text-xs !py-2.5`}
                    onClick={() => setActiveMainTab('simulator')}
                  >
                    Open Simulator
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <GrowthScheduleSimulator
            onCreatePlanFromSimulation={(simData) => {
              setCreateInitialData(simData);
              setShowCreate(true);
            }}
          />
        )}

        {showCreate ? (
          <CreatePlanModal
            tradingAccounts={tradingAccounts}
            initialData={createInitialData}
            onClose={() => setShowCreate(false)}
            onCreated={(created) => {
              setShowCreate(false);
              setActiveMainTab('plans');
              setSelectedId(created.id);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

