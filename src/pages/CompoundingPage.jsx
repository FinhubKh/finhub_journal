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

  return (
    <div className={`${card} ${cardBody}`}>
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{account.name}</h2>
        <p className="mt-1 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
          {formatMoney(account.startingBalance)} → {formatMoney(account.targetBalance)}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {account.targetProfitPercent}% / win · {account.riskPercent}% risk · ~{winsNeeded} wins if all win
        </p>
        {account.tradingAccountId ? (
          <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">Linked: {linkedName || 'Trading account'}</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-400">Standalone plan</p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={onOpen}>
          Open
        </button>
        <button type="button" className={btnDanger} onClick={onDelete}>
          Delete
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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Compounding</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Build compounding growth plans and model multi-period strategy schedules.
            </p>
          </div>
          {activeMainTab === 'plans' && (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                setCreateInitialData(null);
                setShowCreate(true);
              }}
            >
              New plan
            </button>
          )}
        </div>

        {/* Main View Toggle */}
        <div className={`${pillToggle} mb-6 shrink-0`}>
          <button
            type="button"
            className={pillBtn(activeMainTab === 'plans')}
            onClick={() => setActiveMainTab('plans')}
          >
            My Plans ({accounts.length})
          </button>
          <button
            type="button"
            className={pillBtn(activeMainTab === 'simulator')}
            onClick={() => setActiveMainTab('simulator')}
          >
            Growth Schedule Simulator
          </button>
        </div>

        {activeMainTab === 'plans' ? (
          loading ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : accounts.length === 0 ? (
            <div className={`${card} ${emptyState}`}>
              No compounding plans yet. Create one or model a plan in the Growth Schedule Simulator.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

