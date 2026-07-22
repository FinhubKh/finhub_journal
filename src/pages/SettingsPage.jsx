import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import { getUserDisplayName, getUserEmail } from '../api/auth';
import {
  btnDanger, btnGhost, btnPrimary, btnSecondary, card, cardBody, emptyState,
  input, label, msgError, msgSuccess, sectionLabel,
} from '../lib/ui';
import {
  insertModel, deleteModel,
  updateTradingAccount,
} from '../api';
import TradingAccountsManager from '../components/settings/TradingAccountsManager';
import InstallGuideCard from '../components/settings/InstallGuideCard';

const SETTINGS_TABS = [
  {
    id: 'account',
    label: 'Account',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 9.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'mt5',
    label: 'MT5 Setup',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 4.5h10v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 11.5v-7z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 3v1.5M10.5 3v1.5M6 8.5l1.5 1.5L10.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6 6h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'data',
    label: 'Data',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 11.5V13h10v-1.5M8 3v7.5M8 10.5l-2.5-2.5M8 10.5l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
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
      className="sticky top-0 z-10 -mx-4 bg-zinc-50/95 dark:bg-zinc-950/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6"
      role="tablist"
      aria-label="Settings sections"
    >
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SETTINGS_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                active
                  ? 'bg-white dark:bg-zinc-800 text-violet-700 dark:text-emerald-400 shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-700/60'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-white/60 dark:hover:bg-zinc-800/50 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              onClick={() => onChange(tab.id)}
            >
              <span className={`shrink-0 ${active ? 'text-violet-600 dark:text-emerald-400' : 'text-zinc-400'}`}>{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col px-4 pb-6 pt-4 md:px-6 md:pt-6">
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
            <section className="space-y-3" id="trading-accounts">
              <h2 className={sectionLabel}>Trading accounts</h2>
              <TradingAccountsManager
                tradingAccounts={tradingAccounts}
                onSetDefault={setDefaultAccount}
                onUpdated={async () => {
                  await refreshTradingAccounts();
                  await refreshTrades();
                }}
              />
            </section>
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
