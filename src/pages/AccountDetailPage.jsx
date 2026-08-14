import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  deleteTradingAccount,
  generateAccountSyncKey,
  getAccountShareUrl,
  getAccountSyncKey,
  listAccountSyncKeys,
  listInvestorCredentialsStatus,
  regenerateTradingAccountShareToken,
  revokeAccountSyncKey,
  setTradingAccountPublic,
  updateTradingAccount,
} from '../api';
import BackButton from '../components/common/BackButton';
import InvestorSyncPanel from '../components/settings/InvestorSyncPanel';
import {
  AccountFormModal,
  SyncKeyModal,
} from '../components/settings/TradingAccountsManager';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import { accountTypeLabel, pnlDenominationLabel } from '../lib/accounts';
import { invalidateLeaderboardCache } from '../lib/leaderboardCache';
import {
  btnDanger, btnGhost, btnOutline, btnSm, card, cardBody, cardHd, cardTitle,
  dashboardPageWideFull, emptyState, sectionLabel,
} from '../lib/ui';

function formatLastSynced(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Panel({ eyebrow, title, badge, children, danger = false }) {
  return (
    <section
      className={`${card} overflow-hidden ${
        danger ? 'border-rose-200 dark:border-rose-900/50' : ''
      }`}
    >
      <div className={cardHd}>
        <div className="min-w-0">
          <p className={`${sectionLabel} mb-1`}>{eyebrow}</p>
          <h2 className={cardTitle}>{title}</h2>
        </div>
        {badge}
      </div>
      <div className={cardBody}>{children}</div>
    </section>
  );
}

function StatusBadge({ ok, okLabel, idleLabel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        ok
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700'
      }`}
    >
      {ok ? okLabel : idleLabel}
    </span>
  );
}

export default function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { alert, confirm } = useDialog();
  const {
    tradingAccounts,
    refreshTradingAccounts,
    refreshTrades,
  } = useAppData();

  const account = tradingAccounts.find((a) => a.id === accountId) || null;

  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);
  const [syncMeta, setSyncMeta] = useState(null);
  const [investorStatus, setInvestorStatus] = useState(null);

  const reloadSyncState = useCallback(async () => {
    if (!accountId) return;
    try {
      const [keys, investors] = await Promise.all([
        listAccountSyncKeys(),
        listInvestorCredentialsStatus(),
      ]);
      const keyRow = keys.find((r) => r.trading_account_id === accountId) || null;
      setSyncMeta(keyRow ? { id: keyRow.id, last_synced_at: keyRow.last_synced_at || null } : null);
      setInvestorStatus(investors.find((r) => r.trading_account_id === accountId) || null);
    } catch {
      setSyncMeta(null);
      setInvestorStatus(null);
      toast.error('Could not load sync status — check your connection and try again.', { toastId: 'sync-status-error' });
    }
  }, [accountId]);

  useEffect(() => {
    void reloadSyncState();
  }, [reloadSyncState, tradingAccounts.length]);

  async function refreshAll() {
    await refreshTradingAccounts();
    await refreshTrades();
    await reloadSyncState();
  }

  async function handleSetDefault() {
    if (!account) return;
    setBusy(true);
    try {
      await Promise.all(
        tradingAccounts.map((a) => updateTradingAccount(a.id, { is_default: a.id === account.id })),
      );
      await refreshTradingAccounts();
      toast.success('Default account updated');
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not update default account.' });
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishToggle() {
    if (!account) return;
    const next = !account.is_public;
    const ok = await confirm({
      title: next ? `Publish "${account.name}"?` : `Unpublish "${account.name}"?`,
      message: next
        ? 'Anyone with the link can view stats and trade history (notes stay private).'
        : 'The public link and leaderboard listing will stop working until you publish again.',
      confirmLabel: next ? 'Publish' : 'Unpublish',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await setTradingAccountPublic(account.id, next);
      invalidateLeaderboardCache();
      await refreshTradingAccounts();
      if (next) {
        const url = getAccountShareUrl(updated) || `${window.location.origin}/share/${updated?.share_token || ''}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Published — link copied');
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
    const shareUrl = getAccountShareUrl(account);
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied');
    } catch {
      await alert({ title: 'Share link', message: shareUrl });
    }
  }

  async function handleRegenerateLink() {
    const ok = await confirm({
      title: 'Regenerate share link?',
      message: 'The current public URL will stop working immediately.',
      confirmLabel: 'Regenerate',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await regenerateTradingAccountShareToken(account.id);
      invalidateLeaderboardCache();
      await refreshTradingAccounts();
      const url = getAccountShareUrl(updated) || `${window.location.origin}/share/${updated?.share_token || ''}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('New link copied');
      } catch {
        toast.success('Share link regenerated');
      }
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not regenerate share link.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateKey() {
    const hasSyncKey = Boolean(syncMeta);
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
      await reloadSyncState();
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
        await reloadSyncState();
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
      await reloadSyncState();
      toast.success('Sync key revoked');
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not revoke sync key.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove "${account.name}"?`,
      message: 'All synced trades for this account will be permanently deleted. The MT5 sync key will also be revoked.',
      confirmLabel: 'Remove account',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteTradingAccount(account);
      await refreshTradingAccounts();
      await refreshTrades();
      toast.success('Account removed');
      navigate('/dashboard/accounts');
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not remove account.' });
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <div className={`${dashboardPageWideFull} overflow-y-auto`}>
        <BackButton onClick={() => navigate('/dashboard/accounts')} />
        <div className={`${card} ${emptyState} mt-6 py-14`}>
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">Account not found</p>
          <p className="mt-2 text-sm text-zinc-500">It may have been removed.</p>
          <button className={`${btnOutline} mt-5`} type="button" onClick={() => navigate('/dashboard/accounts')}>
            Back to accounts
          </button>
        </div>
      </div>
    );
  }

  const hasSyncKey = Boolean(syncMeta);
  const shareUrl = getAccountShareUrl(account);

  return (
    <div className={`${dashboardPageWideFull} overflow-y-auto`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <BackButton onClick={() => navigate('/dashboard/accounts')} />
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} type="button" disabled={busy} onClick={() => setEditOpen(true)}>
            Edit details
          </button>
          {!account.is_default ? (
            <button className={btnOutline} type="button" disabled={busy} onClick={() => void handleSetDefault()}>
              Set as default
            </button>
          ) : null}
        </div>
      </div>

      <header className={`${card} relative mb-6 overflow-hidden`}>
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: account.color || '#7c3aed' }}
          aria-hidden
        />
        <div className="flex flex-wrap items-start gap-4 p-5 pl-6 sm:p-6 sm:pl-7">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm"
            style={{ backgroundColor: account.color || '#7c3aed' }}
            aria-hidden
          >
            {(account.name || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {account.name}
              </h1>
              {account.is_default ? (
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  Default
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {accountTypeLabel(account.account_type)}
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">·</span>
              {pnlDenominationLabel(account.pnl_denomination)}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Connect this account with an EA sync key, an investor password, or both. Choose what fits how you trade.
            </p>
          </div>
        </div>
      </header>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel
          eyebrow="Option A"
          title="EA sync key"
          badge={<StatusBadge ok={hasSyncKey} okLabel="Key active" idleLabel="No key" />}
        >
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Install the Finhub EA on MetaTrader 5 and paste a sync key. Best if you keep the terminal open locally.
          </p>
          {hasSyncKey ? (
            <p className={`mt-3 text-xs font-medium ${syncMeta?.last_synced_at ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>
              {syncMeta?.last_synced_at
                ? `Last synced: ${formatLastSynced(syncMeta.last_synced_at)}`
                : 'Not synced yet'}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {hasSyncKey ? (
              <>
                <button className={btnSm} type="button" disabled={busy} onClick={() => void handleShowKey()}>
                  Show key
                </button>
                <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                  Regenerate
                </button>
                <button
                  className={btnDanger}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRevokeKey()}
                >
                  Revoke
                </button>
              </>
            ) : (
              <button className={btnSm} type="button" disabled={busy} onClick={() => void handleGenerateKey()}>
                Generate sync key
              </button>
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="Option B"
          title="Investor password"
          badge={(
            <StatusBadge
              ok={Boolean(investorStatus)}
              okLabel="Connected"
              idleLabel="Not connected"
            />
          )}
        >
          <p className="mb-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Read-only MT5 login. We pull closed trades for you — no EA install required.
          </p>
          <div className="-mx-4 -mb-4 border-t border-zinc-100 dark:border-zinc-800 md:-mx-5 md:-mb-5">
            <InvestorSyncPanel
              account={account}
              status={investorStatus}
              onChanged={reloadSyncState}
              compact
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          eyebrow="Sharing"
          title="Public link"
          badge={(
            <StatusBadge
              ok={Boolean(account.is_public)}
              okLabel="Public"
              idleLabel="Private"
            />
          )}
        >
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {account.is_public
              ? 'Anyone with the link can view stats and trade history. Notes stay private.'
              : 'Only you can see this account. Publish to share a read-only link.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btnSm} type="button" disabled={busy} onClick={() => void handlePublishToggle()}>
              {account.is_public ? 'Unpublish' : 'Publish'}
            </button>
            {account.is_public && shareUrl ? (
              <>
                <button className={btnSm} type="button" disabled={busy} onClick={() => void handleCopyLink()}>
                  Copy link
                </button>
                <button className={btnGhost} type="button" disabled={busy} onClick={() => void handleRegenerateLink()}>
                  Regenerate
                </button>
              </>
            ) : null}
          </div>
        </Panel>

        <Panel eyebrow="Danger zone" title="Account controls" danger>
          <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Remove this account permanently. To fix Cent ↔ USD amounts, edit the account and change Account currency — trades rescale automatically.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btnDanger} type="button" disabled={busy} onClick={() => void handleRemove()}>
              Remove account
            </button>
          </div>
        </Panel>
      </div>

      {editOpen ? (
        <AccountFormModal
          mode="edit"
          account={account}
          tradingAccounts={tradingAccounts}
          onClose={() => setEditOpen(false)}
          onSaved={refreshAll}
        />
      ) : null}

      {revealedKey ? (
        <SyncKeyModal
          account={account}
          syncKey={revealedKey}
          onClose={() => setRevealedKey(null)}
        />
      ) : null}
    </div>
  );
}
