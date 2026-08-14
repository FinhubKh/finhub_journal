// src/components/settings/InvestorSyncPanel.jsx
import { useState } from 'react';
import { connectAndVerifyInvestorCredentials, runInvestorSyncAndWait, removeInvestorCredentials } from '../../api';
import { useDialog } from '../../context/DialogContext';
import { toast } from 'react-toastify';
import SyncLoadingModal from '../common/SyncLoadingModal';
import PasswordInput from '../common/PasswordInput';
import BrokerServerFields from './BrokerServerFields';
import {
  btnDanger, btnGhost, btnOutline, btnPrimary, btnSm, input, label, msgError, sectionLabel,
} from '../../lib/ui';

function formatLastSynced(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
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

const EMPTY_CONNECT = {
  brokerId: '',
  serverChoice: '',
  customServer: '',
  brokerServer: '',
  brokerName: '',
  login: '',
  investorPassword: '',
};

export default function InvestorSyncPanel({ account, status, onChanged, compact = false }) {
  const { alert, confirm } = useDialog();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CONNECT);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState(null);
  const [msg, setMsg] = useState(null);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.brokerId) {
      setMsg('Choose your broker first.');
      return;
    }
    if (!form.brokerServer.trim() || !form.login.trim() || !form.investorPassword) {
      setMsg('MT5 server, login, and investor password are all required.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await connectAndVerifyInvestorCredentials({
        tradingAccountId: account.id,
        brokerServer: form.brokerServer.trim(),
        login: form.login.trim(),
        investorPassword: form.investorPassword,
      });
      setForm(EMPTY_CONNECT);
      setFormOpen(false);
      await onChanged();
      toast.success('Investor password connected');
    } catch (err) {
      setMsg(err.message || 'Could not verify investor credentials.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    setBusy(true);
    setSyncing(true);
    setSyncStage(null);
    setMsg(null);
    try {
      const result = await runInvestorSyncAndWait(account.id, {
        onStatus: (row) => {
          setSyncStage(row?.sync_stage || null);
          void onChanged();
        },
      });
      await onChanged();
      setSyncing(false);
      if (result.ok) {
        toast.success('Trades updated');
      } else {
        await alert({
          title: 'Sync failed',
          message: result.error || 'Sync did not finish.',
        });
      }
    } catch (err) {
      await onChanged();
      setSyncing(false);
      await alert({
        title: 'Sync failed',
        message: err.message || 'Could not sync.',
      });
    } finally {
      setSyncing(false);
      setSyncStage(null);
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    const ok = await confirm({
      title: `Disconnect investor password for "${account.name}"?`,
      message: 'You will need to re-enter the investor password to sync via this method again.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeInvestorCredentials(account.id);
      await onChanged();
    } catch (err) {
      await alert({ title: 'Error', message: err.message || 'Could not disconnect.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${compact ? 'bg-transparent px-4 py-4 md:px-5' : 'border-t border-zinc-100 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 md:px-5'}`}>
      <SyncLoadingModal open={syncing} accountName={account?.name} stage={syncStage} />
      {!compact ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className={sectionLabel}>Investor password sync</p>
          <StatusBadge
            ok={Boolean(status)}
            okLabel="Connected"
            idleLabel="Not connected"
          />
        </div>
      ) : null}

      {status ? (
        <>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {status.broker_server} · login {status.login}
          </p>
          <p className={`mt-2 text-xs font-medium ${status.last_synced_at ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>
            {status.last_synced_at ? `Last synced: ${formatLastSynced(status.last_synced_at)}` : 'Not synced yet'}
          </p>
          {status.last_sync_error ? (
            <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">Last sync failed: {status.last_sync_error}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={btnSm} type="button" disabled={busy} onClick={() => void handleSyncNow()}>
              Sync now
            </button>
            <button
              className={btnDanger}
              type="button"
              disabled={busy}
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : formOpen ? (
        <form className="mt-1 space-y-3" onSubmit={handleSave}>
          <BrokerServerFields
            brokerId={form.brokerId}
            serverChoice={form.serverChoice}
            customServer={form.customServer}
            disabled={busy}
            onChange={(next) => {
              setForm((f) => ({
                ...f,
                brokerId: next.brokerId,
                serverChoice: next.serverChoice,
                customServer: next.customServer,
                brokerServer: next.brokerServer,
                brokerName: next.brokerName,
              }));
            }}
          />
          <div>
            <label className={label}>MT5 login</label>
            <input
              className={input}
              placeholder="MT5 login number"
              value={form.login}
              onChange={(e) => setField('login', e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <div>
            <label className={label}>Investor password</label>
            <PasswordInput
              placeholder="Investor (read-only) password"
              value={form.investorPassword}
              onChange={(e) => setField('investorPassword', e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {msg && <p className={msgError}>{msg}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={btnPrimary} type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Connect'}</button>
            <button className={btnGhost} type="button" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Alternative to the EA: choose your broker, pick the MT5 server, then paste a read-only investor password.
          </p>
          <button className={`${btnOutline} mt-3`} type="button" onClick={() => setFormOpen(true)}>
            Connect via investor password
          </button>
        </>
      )}
    </div>
  );
}
