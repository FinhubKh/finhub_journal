import { useState } from 'react';
import { insertTradingAccount, deleteTradingAccount, updateTradingAccount } from '../api';
import { useDialog } from '../context/DialogContext';
import { ACCOUNT_TYPES, ACCOUNT_COLORS, accountTypeLabel, normalizeSlug } from '../lib/accounts';
import {
  btnDanger, btnGhost, btnPrimary, btnSecondary, cardBody, emptyState, input, label, msgError, msgSuccess,
} from '../lib/ui';

const EMPTY_FORM = {
  name: '',
  accountType: 'live',
  broker: '',
  startingBalance: '',
};

function AccountRow({ account, onUpdated, onSetDefault }) {
  const { alert, confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove "${account.name}"?`,
      message: 'Trades keep their history but will lose this account tag.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteTradingAccount(account.id);
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
            <div className="mt-1 text-xs text-zinc-400">Manual / EA sync</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!account.is_default && (
            <button className={btnGhost} type="button" disabled={busy} onClick={() => onSetDefault(account.id)}>
              Default
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

      {msg && <p className={`text-xs ${msg.type === 'error' ? msgError : msgSuccess}`}>{msg.text}</p>}
    </div>
  );
}

export default function TradingAccountsManager({ tradingAccounts, onUpdated, onSetDefault }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAdd() {
    const name = form.name.trim();
    if (!name) {
      setMsg({ type: 'error', text: 'Account name is required.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const color = ACCOUNT_COLORS[tradingAccounts.length % ACCOUNT_COLORS.length];
      await insertTradingAccount({
        name,
        slug: normalizeSlug(name),
        account_type: form.accountType,
        broker: form.broker.trim() || null,
        starting_balance: form.startingBalance ? parseFloat(form.startingBalance) : null,
        color,
        is_default: tradingAccounts.length === 0,
        connection_status: 'manual',
      });
      setForm(EMPTY_FORM);
      setMsg({ type: 'success', text: 'Account added.' });
      await onUpdated();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not add account.' });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  return (
    <>
      <div className={`${cardBody} border-b border-zinc-100 bg-violet-50/50 text-sm leading-relaxed text-zinc-600`}>
        <strong className="font-semibold text-zinc-800">Free sync:</strong> use the MT4/5 EA below with your sync key.
        Set the EA <strong className="font-medium text-zinc-700">Account label</strong> to match the account name here so trades land in the right bucket.
      </div>

      {tradingAccounts.length === 0 ? (
        <div className={emptyState}>No accounts yet. Add a label below, then sync via EA or log trades manually.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {tradingAccounts.map((a) => (
            <AccountRow key={a.id} account={a} onUpdated={onUpdated} onSetDefault={onSetDefault} />
          ))}
        </div>
      )}

      <div className={`${cardBody} space-y-3 border-t border-zinc-100`}>
        <p className="text-sm font-semibold text-zinc-900">Add trading account</p>
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
        <button className={btnPrimary} type="button" disabled={busy} onClick={handleAdd}>
          {busy ? 'Adding...' : 'Add account'}
        </button>
        {msg && <p className={msg.type === 'error' ? msgError : msgSuccess}>{msg.text}</p>}
      </div>
    </>
  );
}
