import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { listInvestorCredentialsStatus, listAccountSyncKeys, runInvestorSyncAndWait } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { useDialog } from '../../context/DialogContext';
import { platformShort } from '../../lib/accounts';
import { btnOutline } from '../../lib/ui';
import SyncLoadingModal, { syncStageLabel } from './SyncLoadingModal';

function formatSyncTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSyncTimeShort(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs >= 0 && diffMs < 60_000) return 'Just now';
  if (diffMs >= 0 && diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs >= 0 && diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function findStatus(rows, accountId) {
  return rows.find((r) => r.trading_account_id === accountId) || null;
}

/**
 * Sync data for the selected account via investor-password bridge.
 * Shows a loading modal that can be dismissed while sync continues in the background.
 */
export default function SyncNowButton({ size = 'md', className = '', variant = 'default' }) {
  const navigate = useNavigate();
  const { alert } = useDialog();
  const { viewMode, activeAccount, refreshTrades } = useAppData();
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [investorStatus, setInvestorStatus] = useState(null);
  const [eaSyncMeta, setEaSyncMeta] = useState(null);
  const syncAbortRef = useRef(null);

  const singleAccount = viewMode === 'account' && activeAccount;
  const hasInvestor = Boolean(investorStatus);
  const isEaAccount = activeAccount?.connection_status === 'ea' || Boolean(eaSyncMeta);
  const platShort = platformShort(activeAccount?.platform);

  const reloadStatus = useCallback(async (alive = () => true) => {
    if (viewMode !== 'account' || !activeAccount?.id) {
      if (alive()) {
        setInvestorStatus(null);
        setEaSyncMeta(null);
        setLoadingStatus(false);
      }
      return null;
    }
    if (alive()) setLoadingStatus(true);
    try {
      const [investorRows, syncKeyRows] = await Promise.all([
        listInvestorCredentialsStatus().catch(() => []),
        listAccountSyncKeys().catch(() => []),
      ]);
      if (!alive()) return null;
      const row = findStatus(investorRows, activeAccount.id);
      const keyRow = findStatus(syncKeyRows, activeAccount.id);
      setInvestorStatus(row);
      setEaSyncMeta(keyRow);
      return row;
    } catch {
      if (alive()) {
        setInvestorStatus(null);
        setEaSyncMeta(null);
        toast.error('Could not load sync status — check your connection and try again.', { toastId: 'sync-status-error' });
      }
      return null;
    } finally {
      if (alive()) setLoadingStatus(false);
    }
  }, [viewMode, activeAccount?.id]);

  useEffect(() => {
    let cancelled = false;
    void reloadStatus(() => !cancelled);
    return () => {
      cancelled = true;
    };
  }, [reloadStatus]);

  useEffect(() => () => {
    syncAbortRef.current?.abort();
  }, []);

  async function handleClick() {
    if (busy) return;

    if (!singleAccount) {
      toast.info('Switch to a single account to sync MetaTrader data.');
      return;
    }
    if (loadingStatus) {
      toast.info('Checking sync status…');
      return;
    }
    if (!hasInvestor) {
      if (isEaAccount) {
        await refreshTrades().catch(() => {});
        const keys = await listAccountSyncKeys().catch(() => []);
        const keyRow = findStatus(keys, activeAccount.id);
        setEaSyncMeta(keyRow);
        if (keyRow?.last_synced_at) {
          toast.success(`Last EA sync: ${formatSyncTime(keyRow.last_synced_at)}. Attach the EA on a chart to pull new trades.`);
        } else {
          await alert({
            title: 'EA sync has not run yet',
            message:
              `The journal cannot pull trades until FinhubJournal_TradeSync is attached to a chart in ${platShort} with this account's sync key.\n\n`
              + '1. Tools -> Options -> Expert Advisors -> Allow WebRequest\n'
              + '2. Add https://journal.finhubkh.com and https://finhubjournal.vercel.app\n'
              + '3. Drag the EA onto a chart, paste the sync key, click OK\n'
              + '4. You should see a "Synced N trades" alert. Then refresh this page.',
          });
        }
        return;
      }
      toast.info(`Connect investor password for "${activeAccount.name}" in Accounts first.`);
      navigate('/dashboard/accounts');
      return;
    }

    const abort = new AbortController();
    syncAbortRef.current?.abort();
    syncAbortRef.current = abort;
    setBusy(true);
    setModalOpen(true);
    try {
      const result = await runInvestorSyncAndWait(activeAccount.id, {
        signal: abort.signal,
        onStatus: setInvestorStatus,
      });
      await refreshTrades();
      if (result.ok) {
        toast.success('Trades updated');
      } else {
        await alert({
          title: 'Sync failed',
          message: result.error || 'Sync did not finish.',
        });
      }
    } catch (err) {
      if (err?.message === 'Sync wait dismissed' || abort.signal.aborted) {
        // Background waiter was dismissed; a follow-up poll may still finish.
        // Keep busy until we detect completion via reload below, or stop if aborted only for unmount.
      } else {
        await refreshTrades().catch(() => {});
        await alert({
          title: 'Sync failed',
          message: err.message || 'Could not sync. Check bridge and investor credentials.',
        });
      }
    } finally {
      if (syncAbortRef.current === abort) syncAbortRef.current = null;
      setModalOpen(false);
      setBusy(false);
      await reloadStatus();
    }
  }

  function handleBackground() {
    setModalOpen(false);
    toast.info('Sync continues in the background');
    // Keep waiting — do not abort. User can navigate while polling continues.
  }

  const toolbar = variant === 'toolbar';
  const compact = size === 'sm' || toolbar;
  const btnClass = toolbar
    ? 'inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/90 px-4 text-[12px] shadow-sm shadow-zinc-900/5 backdrop-blur-sm transition hover:bg-zinc-50 disabled:opacity-45 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/30 dark:hover:bg-zinc-800/80'
    : compact
      ? 'inline-flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98] disabled:opacity-45 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/40 dark:hover:text-violet-300'
      : btnOutline;

  let title = `Sync ${platShort} trades for this account`;
  if (!singleAccount) title = 'Switch to a single account to sync';
  else if (!loadingStatus && !hasInvestor && isEaAccount) title = 'EA accounts sync from MetaTrader — attach the EA on a chart';
  else if (!loadingStatus && !hasInvestor) title = 'Connect investor password in Accounts to sync';
  else if (loadingStatus) title = 'Loading sync status…';
  else if (busy) title = `Waiting for ${platShort} sync to finish…`;

  let statusLine = null;
  let syncMetaShort = null;
  if (singleAccount && hasInvestor) {
    if (busy) {
      statusLine = (
        <span className="text-violet-600 dark:text-violet-400">
          {syncStageLabel(investorStatus?.sync_stage, activeAccount?.platform)}
        </span>
      );
      syncMetaShort = syncStageLabel(investorStatus?.sync_stage, activeAccount?.platform);
    } else if (investorStatus?.last_sync_error) {
      statusLine = (
        <span className="text-rose-600 dark:text-rose-400" title={investorStatus.last_sync_error}>
          Last failed: {investorStatus.last_sync_error}
        </span>
      );
      syncMetaShort = 'Failed';
    } else if (investorStatus?.last_synced_at) {
      const when = formatSyncTime(investorStatus.last_synced_at);
      statusLine = (
        <span className="text-zinc-500 dark:text-zinc-400">
          Last synced: {when}
        </span>
      );
      syncMetaShort = formatSyncTimeShort(investorStatus.last_synced_at) || when;
    } else {
      statusLine = <span className="text-zinc-400">Not synced yet</span>;
      syncMetaShort = 'Never';
    }
  } else if (singleAccount && !loadingStatus && isEaAccount) {
    if (eaSyncMeta?.last_synced_at) {
      const when = formatSyncTime(eaSyncMeta.last_synced_at);
      statusLine = (
        <span className="text-zinc-500 dark:text-zinc-400">
          Last EA sync: {when}
        </span>
      );
      syncMetaShort = formatSyncTimeShort(eaSyncMeta.last_synced_at) || when;
    } else {
      statusLine = <span className="text-zinc-400">EA not synced yet — attach it on a chart</span>;
      syncMetaShort = 'Never';
    }
  } else if (singleAccount && !loadingStatus && !hasInvestor) {
    statusLine = <span className="text-zinc-400">Investor sync not connected</span>;
  }

  return (
    <>
      <div className={`${toolbar ? 'contents' : `inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`.trim()}`}>
        <button
          type="button"
          className={`${btnClass} ${!compact && !toolbar ? 'min-w-[7.5rem]' : ''} ${className}`.trim()}
          disabled={busy || loadingStatus}
          title={title}
          aria-busy={busy || loadingStatus}
          onClick={() => void handleClick()}
        >
          {toolbar ? (
            <>
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                {busy ? 'Syncing…' : 'Sync'}
              </span>
              {syncMetaShort && !busy ? (
                <span className="font-normal text-zinc-400 dark:text-zinc-500">{syncMetaShort}</span>
              ) : null}
            </>
          ) : (
            busy ? 'Syncing…' : 'Sync data'
          )}
        </button>
        {!toolbar && statusLine ? (
          <p className="max-w-[16rem] truncate text-[11px] leading-tight">{statusLine}</p>
        ) : null}
      </div>
      <SyncLoadingModal
        open={modalOpen}
        accountName={activeAccount?.name}
        stage={investorStatus?.sync_stage}
        platform={activeAccount?.platform}
        onBackground={handleBackground}
      />
    </>
  );
}
