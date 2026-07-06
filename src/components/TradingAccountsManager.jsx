import { useEffect, useState } from 'react';
import {
  insertTradingAccount, deleteTradingAccount, updateTradingAccount,
  recalculateTradesForDenomination, repairCentAccountPnl,
  listAccountSyncKeys, getAccountSyncKey, generateAccountSyncKey, revokeAccountSyncKey,
} from '../api';
import { useDialog } from '../context/DialogContext';
import {
  ACCOUNT_TYPES,
  PNL_DENOMINATIONS,
  ACCOUNT_COLORS,
  accountTypeLabel,
  pnlDenominationLabel,
  normalizeSlug,
  normalizePnlDenomination,
} from '../lib/accounts';
import {
  btnDanger, btnGhost, btnOutline, btnPrimary, btnSm, card, cardHd, cardTitle, emptyState, input, msgError, msgSuccess,
  tableTd, tableTh,
} from '../lib/ui';

const EMPTY_FORM = {
  name: '',
  accountType: 'live',
  pnlDenomination: 'usd',
};

function accountToForm(account) {
  return {
    name: account.name || '',
    accountType: account.account_type || 'live',
    pnlDenomination: normalizePnlDenomination(account.pnl_denomination),
  };
}

function AccountFormFields({ form, setField }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Account name</label>
        <input
          className={input}
          placeholder="e.g. FTMO Cent, Personal"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">Type</label>
          <select className={input} value={form.accountType} onChange={(e) => setField('accountType', e.target.value)}>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">Account currency</label>
          <select className={input} value={form.pnlDenomination} onChange={(e) => setField('pnlDenomination', e.target.value)}>
            {PNL_DENOMINATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Choose <strong className="font-medium text-zinc-600">Cent account</strong> if your broker uses cent lots (PnL syncs 100x higher on USD).
        Generate an <strong className="font-medium text-zinc-600">MT5 sync key</strong> for this account after saving.
      </p>
    </div>
  );
}

function AccountFormModal({ mode, account, tradingAccounts, onClose, onSaved }) {
  const { alert } = useDialog();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() => (isEdit ? accountToForm(account) : EMPTY_FORM));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setMsg({ type: 'error', text: 'Account name is required.' });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      if (isEdit) {
        const oldDenom = normalizePnlDenomination(account.pnl_denomination);
        const newDenom = normalizePnlDenomination(form.pnlDenomination);
        await updateTradingAccount(account.id, {
          name,
          slug: normalizeSlug(name),
          account_type: form.accountType,
          pnl_denomination: newDenom,
        });
        const adjusted = await recalculateTradesForDenomination(
          { id: account.id, name },
          oldDenom,
          newDenom,
        );
        await onSaved();
        onClose();
        if (adjusted > 0) {
          await alert({
            title: 'Account saved',
            message: `Adjusted PnL on ${adjusted} trade${adjusted === 1 ? '' : 's'}.`,
          });
        }
      } else {
        const color = ACCOUNT_COLORS[tradingAccounts.length % ACCOUNT_COLORS.length];
        await insertTradingAccount({
          name,
          slug: normalizeSlug(name),
          account_type: form.accountType,
          pnl_denomination: form.pnlDenomination,
          color,
          is_default: tradingAccounts.length === 0,
          connection_status: 'manual',
        });
        await onSaved();
        onClose();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || `Could not ${isEdit ? 'save' : 'add'} account.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className={`${card} w-full max-w-lg shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id="account-form-title" className="text-base font-semibold text-zinc-900">
            {isEdit ? `Edit account — ${account.name}` : 'New trading account'}
          </h2>
          <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Close</button>
        </div>
        <form className="px-5 py-4" onSubmit={handleSubmit}>
          <AccountFormFields form={form} setField={setField} />
          {msg && <p className={`mt-3 ${msg.type === 'error' ? msgError : msgSuccess}`}>{msg.text}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
            <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} type="submit" disabled={busy}>
              {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Add account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SyncKeyModal({ account, syncKey, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(syncKey);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${card} w-full max-w-md shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-key-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 id="sync-key-title" className="text-base font-semibold text-zinc-900">
            MT5 sync key — {account.name}
          </h2>
          <button className={btnGhost} type="button" onClick={onClose}>Close</button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-500">
            Paste this key into the EA <strong className="font-medium text-zinc-700">Sync Key</strong> field on this MT5 account only.
          </p>
          <div className="mt-3 break-all rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 select-all">
            {syncKey}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnOutline} type="button" onClick={copyKey}>Copy</button>
            <button className={btnPrimary} type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountSyncKeyActions({ account, hasKey, onKeysChanged }) {
  const { alert, confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);

  async function handleGenerate() {
    const ok = await confirm({
      title: `Generate sync key for "${account.name}"?`,
      message: hasKey
        ? 'The previous key for this account will stop working until you update MT5.'
        : 'Copy the key into the EA on this MT5 terminal.',
      confirmLabel: 'Generate',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const key = await generateAccountSyncKey(account.id);
      setRevealedKey(key);
      await onKeysChanged();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not generate sync key.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleShow() {
    setBusy(true);
    try {
      const key = await getAccountSyncKey(account.id);
      if (!key) {
        await alert({ title: 'No key found', message: 'Generate a sync key for this account first.' });
        await onKeysChanged();
        return;
      }
      setRevealedKey(key);
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not load sync key.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    const ok = await confirm({
      title: `Revoke sync key for "${account.name}"?`,
      message: 'MT5 will stop syncing for this account until you generate a new key.',
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await revokeAccountSyncKey(account.id);
      await onKeysChanged();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not revoke sync key.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {hasKey ? (
          <>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Active
            </span>
            <button className={btnSm} type="button" disabled={busy} onClick={handleShow}>Show key</button>
            <button className={btnSm} type="button" disabled={busy} onClick={handleGenerate}>Regenerate</button>
            <button className={btnDanger} type="button" disabled={busy} onClick={handleRevoke}>Revoke</button>
          </>
        ) : (
          <>
            <span className="text-xs text-zinc-400">No key</span>
            <button className={btnSm} type="button" disabled={busy} onClick={handleGenerate}>Generate</button>
          </>
        )}
      </div>
      {revealedKey && (
        <SyncKeyModal
          account={account}
          syncKey={revealedKey}
          onClose={() => setRevealedKey(null)}
        />
      )}
    </>
  );
}

function AccountTableRow({ account, hasSyncKey, onEdit, onSetDefault, onUpdated, onKeysChanged }) {
  const { alert, confirm } = useDialog();
  const [busy, setBusy] = useState(false);

  async function handleRepair() {
    const ok = await confirm({
      title: 'Fix cent PnL?',
      message: 'Divides all trade PnL for this account by 100. Only use if profits look 100x too high.',
      confirmLabel: 'Fix PnL',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const count = await repairCentAccountPnl({ id: account.id, name: account.name });
      await onUpdated();
      if (count === 0) {
        await alert({ title: 'No trades found', message: 'No trades are linked to this account yet.' });
      } else {
        await alert({ title: 'PnL fixed', message: `Updated ${count} trade${count === 1 ? '' : 's'}.` });
      }
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not fix PnL.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove "${account.name}"?`,
      message: 'All synced trades for this account will be permanently deleted. The MT5 sync key for this account will also be revoked.',
      confirmLabel: 'Remove account',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteTradingAccount(account);
      await onUpdated();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not remove account.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="transition hover:bg-zinc-50/80">
      <td className={tableTd}>
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
            style={{ backgroundColor: account.color || '#7c3aed' }}
          />
          <span className="font-semibold text-zinc-900">{account.name}</span>
        </div>
      </td>
      <td className={tableTd}>{accountTypeLabel(account.account_type)}</td>
      <td className={tableTd}>{pnlDenominationLabel(account.pnl_denomination)}</td>
      <td className={tableTd}>
        {account.is_default ? (
          <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
            Default
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
      <td className={tableTd}>
        <AccountSyncKeyActions account={account} hasKey={hasSyncKey} onKeysChanged={onKeysChanged} />
      </td>
      <td className={`${tableTd} text-right`}>
        <div className="flex flex-wrap justify-end gap-1">
          <button className={btnSm} type="button" disabled={busy} onClick={() => onEdit(account)}>
            Edit
          </button>
          {account.pnl_denomination === 'cent' && (
            <button className={btnSm} type="button" disabled={busy} onClick={handleRepair}>
              Fix PnL
            </button>
          )}
          {!account.is_default && (
            <button className={btnSm} type="button" disabled={busy} onClick={() => onSetDefault(account.id)}>
              Default
            </button>
          )}
          <button className={btnDanger} type="button" disabled={busy} onClick={handleRemove}>
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function TradingAccountsManager({ tradingAccounts, onUpdated, onSetDefault }) {
  const [modal, setModal] = useState(null);
  const [keyAccountIds, setKeyAccountIds] = useState(new Set());

  async function refreshSyncKeys() {
    try {
      const rows = await listAccountSyncKeys();
      setKeyAccountIds(new Set(rows.map((r) => r.trading_account_id)));
    } catch {
      setKeyAccountIds(new Set());
    }
  }

  useEffect(() => {
    refreshSyncKeys();
  }, [tradingAccounts.length]);

  async function handleKeysChanged() {
    await refreshSyncKeys();
  }

  return (
    <>
      <div className={`${cardHd} border-b border-zinc-100`}>
        <div>
          <h3 className={cardTitle}>Trading accounts</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {tradingAccounts.length === 0
              ? 'Add accounts and generate an MT5 sync key per account'
              : `${tradingAccounts.length} account${tradingAccounts.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button className={btnPrimary} type="button" onClick={() => setModal({ mode: 'add' })}>
          Add account
        </button>
      </div>

      {tradingAccounts.length === 0 ? (
        <div className={emptyState}>
          <p>No trading accounts yet.</p>
          <button className={`${btnOutline} mt-4`} type="button" onClick={() => setModal({ mode: 'add' })}>
            Add your first account
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className={tableTh}>Account</th>
                <th className={tableTh}>Type</th>
                <th className={tableTh}>Currency</th>
                <th className={tableTh}>Status</th>
                <th className={`${tableTh} text-right`}>MT5 sync</th>
                <th className={`${tableTh} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tradingAccounts.map((account) => (
                <AccountTableRow
                  key={account.id}
                  account={account}
                  hasSyncKey={keyAccountIds.has(account.id)}
                  onEdit={(acc) => setModal({ mode: 'edit', account: acc })}
                  onSetDefault={onSetDefault}
                  onUpdated={onUpdated}
                  onKeysChanged={handleKeysChanged}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <AccountFormModal
          mode={modal.mode}
          account={modal.account}
          tradingAccounts={tradingAccounts}
          onClose={() => setModal(null)}
          onSaved={onUpdated}
        />
      )}
    </>
  );
}
