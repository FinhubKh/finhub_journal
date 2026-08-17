import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { listInvestorCredentialsStatus, listAccountSyncKeys, runInvestorSyncAndWait } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { useDialog } from '../../context/DialogContext';
import { btnOutline, btnSm } from '../../lib/ui';
import SyncLoadingModal from './SyncLoadingModal';

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

function findStatus(rows, accountId) {
  return rows.find((r) => r.trading_account_id === accountId) || null;
}

/**
 * Sync data for the selected account via investor-password bridge.
 * Shows a blocking loading modal until trades land or the worker records an error.
 */
export default function SyncNowButton({ size = 'md', className = '' }) {
  const navigate = useNavigate();
  const { alert } = useDialog();
  const { viewMode, activeAccount, refreshTrades } = useAppData();
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [investorStatus, setInvestorStatus] = useState(null);
  const [eaSyncMeta, setEaSyncMeta] = useState(null);

  const singleAccount = viewMode === 'account' && activeAccount;
  const hasInvestor = Boolean(investorStatus);
  const isEaAccount = activeAccount?.connection_status === 'ea' || Boolean(eaSyncMeta);

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

  async function handleClick() {
    if (busy) return;

    if (!singleAccount) {
      toast.info('Switch to a single account to sync MT5 data.');
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
              'The journal cannot pull trades until FinhubJournal_TradeSync is attached to a chart in MT5 with this account\'s sync key.\n\n'
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

    setBusy(true);
    try {
      const result = await runInvestorSyncAndWait(activeAccount.id, {
        onStatus: setInvestorStatus,
      });
      await refreshTrades();
      setBusy(false);
      if (result.ok) {
        toast.success('Trades updated');
      } else {
        await alert({
          title: 'Sync failed',
          message: result.error || 'Sync did not finish.',
        });
      }
    } catch (err) {
      await refreshTrades().catch(() => {});
      setBusy(false);
      await alert({
        title: 'Sync failed',
        message: err.message || 'Could not sync. Check bridge and investor credentials.',
      });
    } finally {
      setBusy(false);
      await reloadStatus();
    }
  }

  const btnClass = size === 'sm' ? btnSm : btnOutline;
  let title = 'Sync MT5 trades for this account';
  if (!singleAccount) title = 'Switch to a single account to sync';
  else if (!loadingStatus && !hasInvestor && isEaAccount) title = 'EA accounts sync from MetaTrader — attach the EA on a chart';
  else if (!loadingStatus && !hasInvestor) title = 'Connect investor password in Accounts to sync';
  else if (loadingStatus) title = 'Loading sync status…';
  else if (busy) title = 'Waiting for MT5 sync to finish…';

  let statusLine = null;
  if (singleAccount && hasInvestor) {
    if (busy) {
      statusLine = <span className="text-violet-600 dark:text-violet-400">Sync in progress…</span>;
    } else if (investorStatus?.last_sync_error) {
      statusLine = (
        <span className="text-rose-600 dark:text-rose-400" title={investorStatus.last_sync_error}>
          Last failed: {investorStatus.last_sync_error}
        </span>
      );
    } else if (investorStatus?.last_synced_at) {
      statusLine = (
        <span className="text-zinc-500 dark:text-zinc-400">
          Last synced: {formatSyncTime(investorStatus.last_synced_at)}
        </span>
      );
    } else {
      statusLine = <span className="text-zinc-400">Not synced yet</span>;
    }
  } else if (singleAccount && !loadingStatus && isEaAccount) {
    if (eaSyncMeta?.last_synced_at) {
      statusLine = (
        <span className="text-zinc-500 dark:text-zinc-400">
          Last EA sync: {formatSyncTime(eaSyncMeta.last_synced_at)}
        </span>
      );
    } else {
      statusLine = <span className="text-zinc-400">EA not synced yet — attach it on a chart</span>;
    }
  } else if (singleAccount && !loadingStatus && !hasInvestor) {
    statusLine = <span className="text-zinc-400">Investor sync not connected</span>;
  }

  return (
    <>
      <div className={`inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`.trim()}>
        <button
          type="button"
          className={`${btnClass} min-w-[7.5rem]`.trim()}
          disabled={busy || loadingStatus}
          title={title}
          aria-busy={busy || loadingStatus}
          onClick={() => void handleClick()}
        >
          Sync data
        </button>
        {statusLine ? (
          <p className="max-w-[16rem] truncate text-[11px] leading-tight">{statusLine}</p>
        ) : null}
      </div>
      <SyncLoadingModal open={busy} accountName={activeAccount?.name} stage={investorStatus?.sync_stage} />
    </>
  );
}
