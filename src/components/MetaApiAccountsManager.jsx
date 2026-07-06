import { useState } from 'react';
import { useDialog } from '../context/DialogContext';
import {
  addMetaApiAccount,
  connectMetaApi,
  syncMetaApi,
  removeMetaApiAccount,
  updateTradingAccount,
} from '../api';
import { ACCOUNT_TYPES, accountTypeLabel, isMetaApiConnected } from '../lib/accounts';
import {
  btnDanger, btnGhost, btnPrimary, btnSecondary, cardBody, emptyState, input, label, msgError, msgSuccess,
} from '../lib/ui';

function statusText(account) {
  if (isMetaApiConnected(account)) return { text: 'Connected', className: 'text-violet-600' };
  if (account.connection_status === 'connecting') return { text: 'Connecting...', className: 'text-amber-600' };
  if (account.connection_status === 'error') return { text: 'Error', className: 'text-rose-600' };
  return { text: 'Not connected', className: 'text-zinc-400' };
}

function AccountCard({ account, onUpdated, onSetDefault }) {
  const { alert, confirm } = useDialog();
  const connected = isMetaApiConnected(account);
  const status = statusText(account);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSync() {
    setBusy(true);
    setMsg(null);
    try {
      const result = await syncMetaApi(account.id);
      const row = result.results?.[0];
      if (row?.error) throw new Error(row.error);
      setMsg({ type: 'success', text: `${row?.inserted || 0} new trade(s) imported.` });
      await onUpdated();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Sync failed.' });
      await onUpdated();
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  async function handleReconnect() {
    if (!password) {
      setMsg({ type: 'error', text: 'Enter investor password to reconnect.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const result = await connectMetaApi({
        tradingAccountId: account.id,
        server: account.metaapi_server,
        login: account.mt_login,
        password,
        platform: account.metaapi_platform || 'mt5',
        updateCredentials: true,
        sync: true,
      });
      setPassword('');
      setReconnectOpen(false);
      setMsg({
        type: 'success',
        text: `Reconnected. ${result.sync?.inserted || 0} new trade(s).`,
      });
      await onUpdated();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Reconnect failed.' });
      await onUpdated();
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove "${account.name}"?`,
      message: 'Trades stay in your journal but will no longer auto-sync.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeMetaApiAccount(account.id);
      await onUpdated();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not remove account.' });
    } finally {
      setBusy(false);
    }
  }

  async function saveBalance(value) {
    const balance = value ? parseFloat(value) : null;
    if (value && (isNaN(balance) || balance <= 0)) return;
    try {
      await updateTradingAccount(account.id, { starting_balance: balance });
      await onUpdated();
    } catch {
      await alert({ title: 'Error', message: 'Could not save balance.' });
    }
  }

  return (
    <div className={`${cardBody} space-y-3 py-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.color || '#7c3aed' }} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900">{account.name}</span>
              {account.is_default && (
                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Default</span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {accountTypeLabel(account.account_type)}
              {account.broker ? ` · ${account.broker}` : ''}
            </div>
            <div className={`mt-1 text-xs font-medium ${status.className}`}>{status.text}</div>
            {account.metaapi_server && (
              <div className="mt-0.5 text-[10px] text-zinc-400">
                {account.metaapi_platform?.toUpperCase() || 'MT5'} · {account.metaapi_server} · #{account.mt_login}
              </div>
            )}
            {account.last_synced_at && (
              <div className="text-[10px] text-zinc-400">
                Last sync: {new Date(account.last_synced_at).toLocaleString()}
              </div>
            )}
            {account.sync_error && (
              <div className="mt-1 text-[10px] text-rose-600">{account.sync_error}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {connected && (
            <button className={btnSecondary} type="button" disabled={busy} onClick={handleSync}>
              {busy ? '...' : 'Sync'}
            </button>
          )}
          {!account.is_default && (
            <button className={btnGhost} type="button" disabled={busy} onClick={() => onSetDefault(account.id)}>
              Default
            </button>
          )}
          {!connected && (
            <button className={btnPrimary} type="button" disabled={busy} onClick={() => setReconnectOpen((v) => !v)}>
              {reconnectOpen ? 'Cancel' : 'Reconnect'}
            </button>
          )}
          <button className={btnDanger} type="button" disabled={busy} onClick={handleRemove}>
            Remove
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-zinc-500">Starting balance</label>
        <input
          className={`${input} max-w-[160px] py-2 text-xs`}
          type="number"
          step="0.01"
          placeholder="e.g. 10000"
          defaultValue={account.starting_balance || ''}
          onBlur={(e) => saveBalance(e.target.value)}
        />
      </div>

      {reconnectOpen && !connected && (
        <div className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
          <div className="min-w-[200px] flex-1">
            <label className={label}>Investor password</label>
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Read-only password"
            />
          </div>
          <button className={btnPrimary} type="button" disabled={busy} onClick={handleReconnect}>
            {busy ? 'Connecting...' : 'Reconnect'}
          </button>
        </div>
      )}

      {msg && <p className={`text-xs ${msg.type === 'error' ? msgError : msgSuccess}`}>{msg.text}</p>}
    </div>
  );
}

const EMPTY_FORM = {
  name: '',
  accountType: 'live',
  broker: '',
  startingBalance: '',
  server: '',
  platform: 'mt5',
  login: '',
  password: '',
};

export default function MetaApiAccountsManager({
  tradingAccounts,
  onUpdated,
  onSetDefault,
  onSyncAll,
  syncingAll,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAdd() {
    if (!form.name.trim() || !form.server.trim() || !form.login.trim() || !form.password) {
      setMsg({ type: 'error', text: 'Name, server, login, and investor password are required.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const result = await addMetaApiAccount({
        name: form.name.trim(),
        accountType: form.accountType,
        broker: form.broker.trim() || undefined,
        startingBalance: form.startingBalance || undefined,
        server: form.server.trim(),
        login: form.login.trim(),
        password: form.password,
        platform: form.platform,
      });
      setForm(EMPTY_FORM);
      setMsg({
        type: 'success',
        text: `Account connected. ${result.sync?.inserted || 0} trade(s) imported.`,
      });
      await onUpdated();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not connect account.' });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  return (
    <>
      {tradingAccounts.length === 0 ? (
        <div className={emptyState}>
          No MT accounts connected yet. Add your first account below with investor password.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {tradingAccounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              onUpdated={onUpdated}
              onSetDefault={onSetDefault}
            />
          ))}
        </div>
      )}

      <div className={`${cardBody} space-y-3 border-t border-zinc-100`}>
        <p className="text-sm font-semibold text-zinc-900">Connect MT account</p>
        <p className="text-xs text-zinc-500">
          Uses MetaAPI with your investor password (read-only). No EA required.
        </p>
        <input
          className={input}
          placeholder="Label (e.g. Exness Live)"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select className={input} value={form.accountType} onChange={(e) => setField('accountType', e.target.value)}>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className={input} placeholder="Broker (optional)" value={form.broker} onChange={(e) => setField('broker', e.target.value)} />
        </div>
        <input
          className={input}
          type="number"
          step="0.01"
          placeholder="Starting balance (optional)"
          value={form.startingBalance}
          onChange={(e) => setField('startingBalance', e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={input} placeholder="MT server (e.g. Exness-MT5Real20)" value={form.server} onChange={(e) => setField('server', e.target.value)} />
          <select className={input} value={form.platform} onChange={(e) => setField('platform', e.target.value)}>
            <option value="mt5">MT5</option>
            <option value="mt4">MT4</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Login / account number" value={form.login} onChange={(e) => setField('login', e.target.value)} />
          <input className={input} type="password" placeholder="Investor password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
        </div>
        <button className={btnPrimary} type="button" disabled={busy} onClick={handleAdd}>
          {busy ? 'Connecting (may take 2-3 min)...' : 'Connect account'}
        </button>
        {tradingAccounts.length > 0 && (
          <button className={btnSecondary} type="button" disabled={syncingAll} onClick={onSyncAll}>
            {syncingAll ? 'Syncing all...' : 'Sync all accounts'}
          </button>
        )}
        {msg && <p className={msg.type === 'error' ? msgError : msgSuccess}>{msg.text}</p>}
      </div>
    </>
  );
}
