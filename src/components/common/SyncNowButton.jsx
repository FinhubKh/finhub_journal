import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { listInvestorCredentialsStatus, triggerInvestorSync } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { useDialog } from '../../context/DialogContext';
import { btnOutline, btnSm } from '../../lib/ui';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queues investor-password sync for the currently selected account.
 * Disabled while status loads; guides user when portfolio view or no investor link.
 */
export default function SyncNowButton({ size = 'md', className = '' }) {
  const navigate = useNavigate();
  const { alert } = useDialog();
  const { viewMode, activeAccount, refreshTrades } = useAppData();
  const [busy, setBusy] = useState(false);
  const [hasInvestor, setHasInvestor] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatusLoaded(false);
      if (viewMode !== 'account' || !activeAccount?.id) {
        if (!cancelled) {
          setHasInvestor(false);
          setStatusLoaded(true);
        }
        return;
      }
      try {
        const rows = await listInvestorCredentialsStatus();
        if (!cancelled) {
          setHasInvestor(rows.some((r) => r.trading_account_id === activeAccount.id));
        }
      } catch {
        if (!cancelled) setHasInvestor(false);
      } finally {
        if (!cancelled) setStatusLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [viewMode, activeAccount?.id]);

  const btnClass = size === 'sm' ? btnSm : btnOutline;
  const singleAccount = viewMode === 'account' && activeAccount;

  async function handleClick() {
    if (!singleAccount) {
      toast.info('Switch to a single account to sync MT5 data.');
      return;
    }
    if (!hasInvestor) {
      toast.info(`Connect investor password for "${activeAccount.name}" in Settings first.`);
      navigate('/dashboard', { state: { tab: 'settings', section: 'trading-accounts' } });
      return;
    }

    setBusy(true);
    try {
      await triggerInvestorSync(activeAccount.id);
      toast.success('Sync queued — updating trades…');
      // Worker writes to Supabase async; refresh a few times so Log/Overview catch up.
      for (const delay of [2500, 5000, 8000]) {
        await sleep(delay);
        await refreshTrades();
      }
      toast.success('Trade data refreshed');
    } catch (err) {
      await alert({
        title: 'Sync failed',
        message: err.message || 'Could not start sync. Check bridge and investor credentials.',
      });
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || !statusLoaded;
  let title = 'Sync MT5 trades for this account';
  if (!singleAccount) title = 'Switch to a single account to sync';
  else if (statusLoaded && !hasInvestor) title = 'Connect investor password in Settings to sync';

  return (
    <button
      type="button"
      className={`${btnClass} ${className}`.trim()}
      disabled={disabled}
      title={title}
      onClick={() => void handleClick()}
    >
      {busy ? 'Syncing…' : 'Sync data'}
    </button>
  );
}
