import { useEffect, useState } from 'react';
import {
  insertTradingAccount, deleteTradingAccount, updateTradingAccount,
  recalculateTradesForDenomination, repairCentAccountPnl,
  listAccountSyncKeys, getAccountSyncKey, generateAccountSyncKey, revokeAccountSyncKey,
  setTradingAccountPublic, getAccountShareUrl,
} from '../../api';
import { useDialog } from '../../context/DialogContext';
import { toast } from 'react-toastify';
import { invalidateLeaderboardCache } from '../../lib/leaderboardCache';
import {
  ACCOUNT_TYPES,
  PNL_DENOMINATIONS,
  ACCOUNT_COLORS,
  accountTypeLabel,
  pnlDenominationLabel,
  normalizeSlug,
  normalizePnlDenomination,
} from '../../lib/accounts';
import {
  btnDanger, btnGhost, btnOutline, btnPrimary, btnSm, card, emptyState, input, msgError, msgSuccess,
} from '../../lib/ui';
import CustomDropdown from '../common/CustomDropdown';

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

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-zinc-100 text-zinc-600',
    accent: 'bg-violet-100 text-violet-700',
    success: 'bg-emerald-50 text-emerald-700',
    muted: 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
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
          <CustomDropdown
            className="w-full"
            menuClassName="w-full"
            value={form.accountType}
            onChange={(v) => setField('accountType', v)}
            options={ACCOUNT_TYPES}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">Account currency</label>
          <CustomDropdown
            className="w-full"
            menuClassName="w-full"
            value={form.pnlDenomination}
            onChange={(v) => setField('pnlDenomination', v)}
            options={PNL_DENOMINATIONS}
          />
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

function AccountCard({ account, hasSyncKey, onEdit, onSetDefault, onUpdated, onKeysChanged }) {
  const { alert, confirm } = useDialog();
  const [busy, setBusy] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);
  const shareUrl = getAccountShareUrl(account);

  async function handlePublishToggle() {
    const next = !account.is_public;
    if (next) {
      const ok = await confirm({
        title: `Publish "${account.name}"?`,
        message: 'Anyone with the link can view this account’s stats and full trade history. Sync keys stay private.',
        confirmLabel: 'Publish',
      });
      if (!ok) return;
    } else {
      const ok = await confirm({
        title: `Unpublish "${account.name}"?`,
        message: 'The public link will stop working until you publish again.',
        confirmLabel: 'Unpublish',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const updated = await setTradingAccountPublic(account.id, next);
      invalidateLeaderboardCache();
      await onUpdated();
      if (next) {
        const url = getAccountShareUrl(updated) || `${window.location.origin}/share/${updated?.share_token || ''}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Account published — link copied');
        } catch {
          toast.success('Account published');
        }
      } else {
        toast.success('Account unpublished');
      }
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not update publish status.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied');
    } catch {
      await alert({ title: 'Share link', message: shareUrl });
    }
  }

  async function handleGenerateKey() {
    const ok = await confirm({
      title: `Generate sync key for "${account.name}"?`,
      message: hasSyncKey
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

  async function handleShowKey() {
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

  async function handleRevokeKey() {
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
    <>
      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:border-zinc-300">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                style={{ backgroundColor: account.color || '#7c3aed' }}
                aria-hidden
              />
              <h4 className="truncate text-base font-semibold tracking-tight text-zinc-900">{account.name}</h4>
              {account.is_default ? <Badge tone="accent">Default</Badge> : null}
            </div>
            <p className="mt-1.5 text-sm text-zinc-500">
              {accountTypeLabel(account.account_type)}
              <span className="mx-1.5 text-zinc-300">·</span>
              {pnlDenominationLabel(account.pnl_denomination)}
            </p>
          </div>
          <button className={btnSm} type="button" disabled={busy} onClick={() => onEdit(account)}>
            Edit
          </button>
        </div>

        <div className="grid gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-2">
          <div className="bg-white px-4 py-4 md:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Sharing</p>
              {account.is_public ? <Badge tone="success">Public</Badge> : <Badge tone="muted">Private</Badge>}
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              {account.is_public
                ? 'Anyone with the link can view stats and trade history.'
                : 'Only you can see this account. Publish to share a read-only link.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btnSm} type="button" disabled={busy} onClick={() => void handlePublishToggle()}>
                {account.is_public ? 'Unpublish' : 'Publish'}
              </button>
              {account.is_public && shareUrl ? (
                <button className={btnOutline} type="button" disabled={busy} onClick={() => void handleCopyLink()}>
                  Copy link
                </button>
              ) : null}
            </div>
          </div>

          <div className="bg-white px-4 py-4 md:px-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">MT5 sync</p>
              {hasSyncKey ? <Badge tone="success">Connected</Badge> : <Badge tone="muted">No key</Badge>}
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              {hasSyncKey
                ? 'A sync key is active for this account. Show it to reconnect the EA if needed.'
                : 'Generate a key and paste it into the EA Sync Key field on this terminal.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasSyncKey ? (
                <>
                  <button className={btnSm} type="button" disabled={busy} onClick={() => void handleShowKey()}>
                    Show key
                  </button>
                  <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                    Regenerate
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-45"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRevokeKey()}
                  >
                    Revoke
                  </button>
                </>
              ) : (
                <button className={btnSm} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                  Generate key
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 md:px-5">
          <div className="flex flex-wrap gap-2">
            {!account.is_default ? (
              <button className={btnGhost} type="button" disabled={busy} onClick={() => onSetDefault(account.id)}>
                Set as default
              </button>
            ) : (
              <span className="self-center text-xs text-zinc-400">Used as your default account</span>
            )}
            {account.pnl_denomination === 'cent' ? (
              <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleRepair()}>
                Fix cent PnL
              </button>
            ) : null}
          </div>
          <button className={btnDanger} type="button" disabled={busy} onClick={() => void handleRemove()}>
            Remove
          </button>
        </div>
      </article>

      {revealedKey ? (
        <SyncKeyModal
          account={account}
          syncKey={revealedKey}
          onClose={() => setRevealedKey(null)}
        />
      ) : null}
    </>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {tradingAccounts.length === 0
            ? 'Add an account, then generate an MT5 sync key for it.'
            : `${tradingAccounts.length} account${tradingAccounts.length === 1 ? '' : 's'} · sync, share, and set your default`}
        </p>
        <button className={btnPrimary} type="button" onClick={() => setModal({ mode: 'add' })}>
          Add account
        </button>
      </div>

      {tradingAccounts.length === 0 ? (
        <div className={`${card} ${emptyState} mt-3`}>
          <p>No trading accounts yet.</p>
          <button className={`${btnOutline} mt-4`} type="button" onClick={() => setModal({ mode: 'add' })}>
            Add your first account
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {tradingAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              hasSyncKey={keyAccountIds.has(account.id)}
              onEdit={(acc) => setModal({ mode: 'edit', account: acc })}
              onSetDefault={onSetDefault}
              onUpdated={onUpdated}
              onKeysChanged={handleKeysChanged}
            />
          ))}
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
