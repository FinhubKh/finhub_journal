import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { listInvestorCredentialsStatus, triggerInvestorSync } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { useDialog } from '../../context/DialogContext';
import { btnOutline, btnSm } from '../../lib/ui';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Polls DB status until the worker finishes, then refreshes trades once.
 */
export default function SyncNowButton({ size = 'md', className = '' }) {
  const navigate = useNavigate();
  const { alert } = useDialog();
  const { viewMode, activeAccount, refreshTrades } = useAppData();
  const [busy, setBusy] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [investorStatus, setInvestorStatus] = useState(null);

  const singleAccount = viewMode === 'account' && activeAccount;
  const hasInvestor = Boolean(investorStatus);

  const reloadStatus = useCallback(async () => {
    if (viewMode !== 'account' || !activeAccount?.id) {
      setInvestorStatus(null);
      setLoadingStatus(false);
      return null;
    }
    setLoadingStatus(true);
    try {
      const rows = await listInvestorCredentialsStatus();
      const row = findStatus(rows, activeAccount.id);
      setInvestorStatus(row);
      return row;
    } catch {
      setInvestorStatus(null);
      return null;
    } finally {
      setLoadingStatus(false);
    }
  }, [viewMode, activeAccount?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await reloadStatus();
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadStatus]);

  async function waitForWorkerResult(baseline) {
    const baselineSynced = baseline?.last_synced_at || null;
    const baselineUpdated = baseline?.updated_at || null;
    const baselineError = baseline?.last_sync_error || null;

    for (let i = 0; i < 15; i += 1) {
      await sleep(2000);
      let rows;
      try {
        rows = await listInvestorCredentialsStatus();
      } catch {
        continue;
      }
      const row = findStatus(rows, activeAccount.id);
      if (!row) continue;

      setInvestorStatus(row);

      if (row.last_synced_at && row.last_synced_at !== baselineSynced) {
        return { ok: true, row };
      }

      const updatedChanged = row.updated_at && row.updated_at !== baselineUpdated;
      const errorChanged = (row.last_sync_error || null) !== baselineError;
      if (row.last_sync_error && (updatedChanged || errorChanged || !baselineSynced)) {
        // New or refreshed failure from the worker
        if (updatedChanged || errorChanged) {
          return { ok: false, row, error: row.last_sync_error };
        }
      }
    }

    const latest = await reloadStatus();
    if (latest?.last_synced_at && latest.last_synced_at !== baselineSynced) {
      return { ok: true, row: latest };
    }
    if (latest?.last_sync_error) {
      return { ok: false, row: latest, error: latest.last_sync_error, timedOut: true };
    }
    return { ok: false, timedOut: true, error: 'Sync is taking longer than expected. Try Refresh in a moment.' };
  }

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
      toast.info(`Connect investor password for "${activeAccount.name}" in Settings first.`);
      navigate('/dashboard', { state: { tab: 'settings', section: 'trading-accounts' } });
      return;
    }

    setBusy(true);
    const baseline = investorStatus;
    try {
      await triggerInvestorSync(activeAccount.id);
      toast.info('Sync started…');
      const result = await waitForWorkerResult(baseline);
      if (result.ok) {
        await refreshTrades();
        toast.success('Trades updated');
      } else {
        await refreshTrades();
        const message = result.error || 'Sync did not finish.';
        if (result.timedOut && !result.row?.last_sync_error) {
          toast.warn(message);
        } else {
          await alert({ title: 'Sync failed', message });
        }
      }
    } catch (err) {
      await alert({
        title: 'Sync failed',
        message: err.message || 'Could not start sync. Check bridge and investor credentials.',
      });
    } finally {
      setBusy(false);
      await reloadStatus();
    }
  }

  const btnClass = size === 'sm' ? btnSm : btnOutline;
  let title = 'Sync MT5 trades for this account';
  if (!singleAccount) title = 'Switch to a single account to sync';
  else if (!loadingStatus && !hasInvestor) title = 'Connect investor password in Settings to sync';
  else if (loadingStatus) title = 'Loading sync status…';

  let statusLine = null;
  if (singleAccount && hasInvestor) {
    if (busy) {
      statusLine = <span className="text-violet-600 dark:text-violet-400">Syncing…</span>;
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
  } else if (singleAccount && !loadingStatus && !hasInvestor) {
    statusLine = <span className="text-zinc-400">Investor sync not connected</span>;
  }

  const label = busy ? 'Syncing…' : loadingStatus ? 'Sync data' : 'Sync data';

  return (
    <div className={`flex flex-col items-end gap-0.5 ${className}`.trim()}>
      <button
        type="button"
        className={`${btnClass} min-w-[7.5rem]`.trim()}
        disabled={busy}
        title={title}
        aria-busy={busy || loadingStatus}
        onClick={() => void handleClick()}
      >
        {loadingStatus && !busy ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-600"
              aria-hidden
            />
            Sync data
          </span>
        ) : (
          label
        )}
      </button>
      {statusLine ? (
        <p className="max-w-[16rem] truncate text-right text-[11px] leading-tight">{statusLine}</p>
      ) : null}
    </div>
  );
}
