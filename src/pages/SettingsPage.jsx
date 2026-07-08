import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import { getUserDisplayName, getUserEmail } from '../api/auth';
import {
  btnDanger, btnGhost, btnPrimary, btnSecondary, card, cardBody, dashboardPageWide, emptyState,
  input, label, msgError, msgSuccess, sectionLabel,
} from '../lib/ui';
import {
  insertModel, deleteModel,
  updateTradingAccount,
} from '../api';
import TradingAccountsManager from '../components/settings/TradingAccountsManager';
import InstallGuideCard from '../components/settings/InstallGuideCard';

const SETTINGS_TABS = [
  { id: 'account', label: 'Account' },
  { id: 'mt5', label: 'MT5 Setup' },
  { id: 'journal', label: 'Journal' },
  { id: 'data', label: 'Data' },
];

const FOCUS_TO_TAB = {
  'trading-accounts': 'account',
  'mt5-setup': 'mt5',
  setup: 'mt5',
};

function SettingsSection({ title, children, id }) {
  return (
    <section className="space-y-2" id={id}>
      {title && <h2 className={sectionLabel}>{title}</h2>}
      <div className={card}>{children}</div>
    </section>
  );
}

function SettingsRow({ title, sub, children }) {
  return (
    <div className={`${cardBody} flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100`}>
      <div>
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        {sub && <div className="mt-0.5 text-sm text-zinc-500">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsTabBar({ activeTab, onChange }) {
  return (
    <nav
      className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-zinc-50 md:-mx-6"
      role="tablist"
      aria-label="Settings sections"
    >
      <div className="flex gap-0 overflow-x-auto px-4 md:px-6">
        {SETTINGS_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                active
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-zinc-500 hover:border-zinc-200 hover:text-zinc-800'
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function SettingsPage({ focusSection = null }) {
  const navigate = useNavigate();
  const { alert, confirm } = useDialog();
  const { signOut, setDisplayName } = useAuth();
  const {
    userModels,
    tradingAccounts,
    refreshModels,
    refreshTradingAccounts,
    refreshTrades,
    allTrades,
  } = useAppData();

  const [activeTab, setActiveTab] = useState(() =>
    focusSection && FOCUS_TO_TAB[focusSection] ? FOCUS_TO_TAB[focusSection] : 'account',
  );

  const email = getUserEmail();

  const [dnInput, setDnInput] = useState(getUserDisplayName());
  const [dnMsg, setDnMsg] = useState(null);
  const [dnSaving, setDnSaving] = useState(false);

  const [newModelName, setNewModelName] = useState('');

  useEffect(() => {
    if (focusSection && FOCUS_TO_TAB[focusSection]) {
      setActiveTab(FOCUS_TO_TAB[focusSection]);
    }
  }, [focusSection]);

  async function saveDisplayName() {
    const name = dnInput.trim();
    if (!name) return;
    setDnSaving(true);
    try {
      await setDisplayName(name);
      setDnMsg({ text: 'Saved!', type: 'success' });
      setTimeout(() => setDnMsg(null), 3000);
    } catch (e) {
      setDnMsg({ text: e.message, type: 'error' });
    } finally {
      setDnSaving(false);
    }
  }

  async function addModel() {
    const name = newModelName.trim();
    if (!name) {
      await alert({ title: 'Missing name', message: 'Please enter a model name.' });
      return;
    }
    try { await insertModel(name); setNewModelName(''); await refreshModels(); }
    catch (e) {
      await alert({ title: 'Error', message: 'Could not add model.' });
    }
  }

  async function removeModel(id) {
    const ok = await confirm({
      title: 'Delete model?',
      message: 'This entry model will be removed from your journal.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteModel(id); await refreshModels(); }
    catch (e) {
      await alert({ title: 'Error', message: 'Could not delete model.' });
    }
  }

  async function setDefaultAccount(id) {
    try {
      await Promise.all(
        tradingAccounts.map((a) => updateTradingAccount(a.id, { is_default: a.id === id })),
      );
      await refreshTradingAccounts();
    } catch (e) {
      await alert({ title: 'Error', message: 'Could not update default account.' });
    }
  }

  async function exportCSV() {
    if (allTrades.length === 0) {
      await alert({ title: 'Nothing to export', message: 'No trades to export yet.' });
      return;
    }
    const headers = ['Date', 'Result', 'R Value', 'PnL (USD)', 'Account', 'Model', 'Session', 'Notes'];
    const rows = allTrades.map((t) => [t.date, t.result, t.r_value || '', t.pnl_usd || '', t.account || '', t.model || '', t.session || '', (t.notes || '').replace(/,/g, ' ')]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `nxuu-trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="flex h-full min-h-[calc(100dvh-3rem)] w-full min-w-0 flex-col p-4 pb-6 md:p-6">
      <div className="mb-4 shrink-0">
        <h1 className="text-lg font-bold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Trading accounts and journal preferences.</p>
      </div>

      <div className="shrink-0">
        <SettingsTabBar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mt-5 flex-1 flex flex-col space-y-5">
        {activeTab === 'account' && (
          <>
            <SettingsSection title="Trading accounts" id="trading-accounts">
              <TradingAccountsManager
                tradingAccounts={tradingAccounts}
                onSetDefault={setDefaultAccount}
                onUpdated={async () => {
                  await refreshTradingAccounts();
                  await refreshTrades();
                }}
              />
            </SettingsSection>
          </>
        )}

        {activeTab === 'mt5' && (
          <InstallGuideCard standalone />
        )}

        {activeTab === 'journal' && (
          <>
            <SettingsSection title="Entry Models">
              {userModels.length === 0 ? (
                <div className={emptyState}>No models yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {userModels.map((m) => (
                    <div className={`${cardBody} flex items-center justify-between gap-3 py-3`} key={m.id}>
                      <div className="text-sm font-medium text-zinc-900">{m.name}</div>
                      <button className={btnGhost} type="button" onClick={() => removeModel(m.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`${cardBody} space-y-3 border-t border-zinc-100`}>
                <input className={input} type="text" placeholder="Model name (e.g. Jab Kvort)" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} />
                <button className={btnSecondary} type="button" onClick={addModel}>+ Add Model</button>
              </div>
            </SettingsSection>
          </>
        )}

        {activeTab === 'data' && (
          <>
            <SettingsSection title="Profile">
              <SettingsRow title="Signed in as" sub={email}>
                <button className={btnDanger} onClick={async () => { await signOut(); navigate('/'); }}>Sign Out</button>
              </SettingsRow>
              <div className={`${cardBody} space-y-3`}>
                <label className={label}>Display name</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input className={`${input} min-w-[200px] flex-1`} type="text" placeholder="e.g. FinhubKH_Trader1"
                    value={dnInput} onChange={(e) => setDnInput(e.target.value)} />
                  <button className={btnPrimary} type="button" disabled={dnSaving} onClick={saveDisplayName}>{dnSaving ? 'Saving...' : 'Save'}</button>
                </div>
                {dnMsg && <p className={dnMsg.type === 'error' ? msgError : msgSuccess}>{dnMsg.text}</p>}
              </div>
            </SettingsSection>

            <SettingsSection title="Export">
              <SettingsRow title="Export trades" sub="Download all your trades as CSV">
                <button className={btnGhost} onClick={exportCSV}>Export CSV</button>
              </SettingsRow>
            </SettingsSection>
          </>
        )}
      </div>
    </div>
  );
}
