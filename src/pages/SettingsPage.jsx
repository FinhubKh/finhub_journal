import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import { getUserDisplayName, getUserEmail } from '../api/auth';
import {
  btnDanger, btnGhost, btnPrimary, btnSecondary, card, cardBody, dashboardPage, emptyState,
  input, label, msgError, msgSuccess, sectionLabel,
} from '../lib/ui';
import {
  insertStep, deleteStep, insertModel, deleteModel,
  generateSyncKey, hasSyncKey, revokeSyncKey, getSyncKey,
  updateTradingAccount,
} from '../api';
import TradingAccountsManager from '../components/TradingAccountsManager';

const SETTINGS_TABS = [
  { id: 'account', label: 'Account' },
  { id: 'sync', label: 'Sync' },
  { id: 'journal', label: 'Journal' },
  { id: 'data', label: 'Data' },
];

const FOCUS_TO_TAB = {
  'trading-accounts': 'sync',
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

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="h-6 w-11 rounded-full bg-zinc-200 transition peer-checked:bg-violet-600" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
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
    userSteps,
    userModels,
    tradingAccounts,
    excludeDemoFromPortfolio,
    setExcludeDemoFromPortfolio,
    refreshSteps,
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

  const [newStepSection, setNewStepSection] = useState('');
  const [newStepTitle, setNewStepTitle] = useState('');

  const [newModelName, setNewModelName] = useState('');

  const [syncStatus, setSyncStatus] = useState('—');
  const [syncReveal, setSyncReveal] = useState(null);

  useEffect(() => { refreshSyncStatus(); loadSyncKey(); }, []);

  useEffect(() => {
    if (focusSection && FOCUS_TO_TAB[focusSection]) {
      setActiveTab(FOCUS_TO_TAB[focusSection]);
    }
  }, [focusSection]);

  async function loadSyncKey() {
    try { const k = await getSyncKey(); if (k) setSyncReveal(k); } catch (e) { /* ignore */ }
  }

  async function refreshSyncStatus() {
    try { setSyncStatus((await hasSyncKey()) ? 'Sync key active' : 'No sync key yet'); }
    catch (e) { setSyncStatus('—'); }
  }

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

  async function addStep() {
    const section = newStepSection.trim(), title = newStepTitle.trim();
    if (!section || !title) {
      await alert({ title: 'Missing fields', message: 'Please fill in both section and title.' });
      return;
    }
    try {
      await insertStep(section, title, userSteps.length);
      setNewStepSection(''); setNewStepTitle('');
      await refreshSteps();
    } catch (e) {
      await alert({ title: 'Error', message: 'Could not add step.' });
    }
  }

  async function removeStep(id) {
    const ok = await confirm({
      title: 'Delete step?',
      message: 'This checklist step will be removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteStep(id); await refreshSteps(); }
    catch (e) {
      await alert({ title: 'Error', message: 'Could not delete step.' });
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

  async function handleGenerateSyncKey() {
    const ok = await confirm({
      title: 'Generate new sync key?',
      message: 'Any previous key and your EA config will stop working until you update them.',
      confirmLabel: 'Generate',
    });
    if (!ok) return;
    try {
      const key = await generateSyncKey();
      setSyncReveal(key);
      await refreshSyncStatus();
    } catch (e) {
      await alert({ title: 'Error', message: 'Could not generate sync key.' });
    }
  }

  async function handleRevokeSyncKey() {
    const ok = await confirm({
      title: 'Revoke sync key?',
      message: 'The EA will stop syncing until you generate a new key.',
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    try { await revokeSyncKey(); setSyncReveal(null); await refreshSyncStatus(); }
    catch (e) {
      await alert({ title: 'Error', message: 'Could not revoke key.' });
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
    <div className={dashboardPage}>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your account, sync, and journal preferences.</p>
      </div>

      <SettingsTabBar activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-5 space-y-5">
        {activeTab === 'account' && (
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

            <SettingsSection title="Portfolio">
              <SettingsRow
                title="Exclude demo from portfolio"
                sub="Demo account trades won't count in Portfolio totals on Overview, Log, and Calendar"
              >
                <Toggle checked={excludeDemoFromPortfolio} onChange={setExcludeDemoFromPortfolio} />
              </SettingsRow>
              <div className={`${cardBody} text-sm text-zinc-500`}>
                Use the sidebar switcher to view <strong className="font-medium text-zinc-700">Portfolio</strong> (all accounts combined) or drill into a single account.
              </div>
            </SettingsSection>
          </>
        )}

        {activeTab === 'sync' && (
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

            <SettingsSection title="MT4/5 EA sync (free)">
              <SettingsRow title="Sync Key" sub={syncStatus}>
                <div className="flex flex-wrap gap-2">
                  <button className={btnSecondary} type="button" onClick={handleGenerateSyncKey}>Generate</button>
                  <button className={btnDanger} type="button" onClick={handleRevokeSyncKey}>Revoke</button>
                </div>
              </SettingsRow>
              {syncReveal && (
                <div className={`${cardBody} border-b border-zinc-100`}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your sync key</div>
                  <div className="mt-2 break-all rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 select-all">{syncReveal}</div>
                  <p className="mt-2 text-xs text-zinc-400">Paste into the EA Sync Key field in MT4/5. Run <code className="text-zinc-600">npm run ea:config</code> after setting <code className="text-zinc-600">EA_API_URL</code> in .env.</p>
                </div>
              )}
              <div className={`${cardBody} text-sm leading-relaxed text-zinc-500`}>
                Attach the nXuu EA in MetaTrader — it sends closed trades on startup. No paid service required.
                Match the EA account label to your trading account name above.
              </div>
            </SettingsSection>
          </>
        )}

        {activeTab === 'journal' && (
          <>
            <SettingsSection title="Checklist Steps">
              {userSteps.length === 0 ? (
                <div className={emptyState}>No steps yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {userSteps.map((s) => (
                    <div className={`${cardBody} flex items-center justify-between gap-3 py-3`} key={s.id}>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-violet-600">{s.section}</div>
                        <div className="text-sm font-medium text-zinc-900">{s.title}</div>
                      </div>
                      <button className={btnGhost} type="button" onClick={() => removeStep(s.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`${cardBody} space-y-3 border-t border-zinc-100`}>
                <input className={input} type="text" placeholder="Section (e.g. HTF Context)" value={newStepSection} onChange={(e) => setNewStepSection(e.target.value)} />
                <input className={input} type="text" placeholder="Step title" value={newStepTitle} onChange={(e) => setNewStepTitle(e.target.value)} />
                <button className={btnSecondary} type="button" onClick={addStep}>+ Add Step</button>
              </div>
            </SettingsSection>

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
          <SettingsSection title="Export">
            <SettingsRow title="Export trades" sub="Download all your trades as CSV">
              <button className={btnGhost} onClick={exportCSV}>Export CSV</button>
            </SettingsRow>
          </SettingsSection>
        )}
      </div>
    </div>
  );
}
