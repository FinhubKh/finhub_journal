import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { deleteTradingAccount } from '../api';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import { accountTypeLabel, pnlDenominationLabel } from '../lib/accounts';
import { AccountFormModal } from '../components/settings/TradingAccountsManager';
import {
  btnOutline, btnPrimary, card, dashboardPageWideFull, emptyState,
} from '../lib/ui';

function IconButton({ label, onClick, tone = 'neutral', children }) {
  const toneClass = tone === 'danger'
    ? 'text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400'
    : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${toneClass}`}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.5 2.5l2 2M3 13l.6-2.4L11.2 3l2 2L5.4 12.8 3 13z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6.5 4.5V3.5a1 1 0 011-1h1a1 1 0 011 1v1M6 7v4.5M10 7v4.5M4.5 4.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccountListCard({ account, onOpen, onEdit, onDelete, busy }) {
  return (
    <div
      className={`${card} group relative w-full overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:hover:border-violet-600`}
    >
      <div
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: account.color || '#7c3aed' }}
        aria-hidden
      />
      <div className="flex items-center gap-3 p-5 pl-6">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <h3 className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {account.name}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {accountTypeLabel(account.account_type)}
            {' · '}
            {pnlDenominationLabel(account.pnl_denomination)}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label={`Edit ${account.name}`} onClick={onEdit}>
            <EditIcon />
          </IconButton>
          <IconButton label={`Delete ${account.name}`} onClick={onDelete} tone="danger">
            <TrashIcon />
          </IconButton>
          <button
            type="button"
            onClick={onOpen}
            disabled={busy}
            aria-label={`Open ${account.name}`}
            title="Open account"
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition hover:bg-violet-100 hover:text-violet-600 dark:bg-zinc-800 dark:hover:bg-violet-950/50 dark:hover:text-violet-400"
          >
            <ChevronIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const { alert, confirm } = useDialog();
  const {
    tradingAccounts,
    refreshTradingAccounts,
    refreshTrades,
  } = useAppData();

  const [modal, setModal] = useState(null);
  const [busyId, setBusyId] = useState('');

  async function handleSaved() {
    await refreshTradingAccounts();
    await refreshTrades();
  }

  async function handleDelete(account) {
    const ok = await confirm({
      title: `Remove "${account.name}"?`,
      message: 'All synced trades for this account will be permanently deleted. The MT5 sync key will also be revoked.',
      confirmLabel: 'Remove account',
      destructive: true,
    });
    if (!ok) return;

    setBusyId(account.id);
    try {
      await deleteTradingAccount(account);
      await refreshTradingAccounts();
      await refreshTrades();
      toast.success('Account removed');
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not remove account.' });
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className={`${dashboardPageWideFull} overflow-y-auto`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Trading Accounts
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Manage your accounts, connect to MT5 with an EA sync key, and set up your trading journal.
          </p>
        </div>
        <button className={btnPrimary} type="button" onClick={() => setModal({ mode: 'add' })}>
          + Add Account
        </button>
      </header>

      {tradingAccounts.length === 0 ? (
        <div className={`${card} ${emptyState} flex flex-col items-center justify-center py-16 text-center`}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No trading accounts yet</h3>
          <p className="mx-auto mt-2 mb-8 max-w-sm text-sm text-zinc-500 text-center">
            Create an account, then connect MT5 with an EA sync key or an investor password to start journaling.
          </p>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setModal({ mode: 'add' })}
          >
            + Add First Account
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tradingAccounts.map((account) => (
            <AccountListCard
              key={account.id}
              account={account}
              busy={busyId === account.id}
              onOpen={() => navigate(`/dashboard/accounts/${account.id}`)}
              onEdit={() => setModal({ mode: 'edit', account })}
              onDelete={() => void handleDelete(account)}
            />
          ))}
        </div>
      )}

      {modal ? (
        <AccountFormModal
          mode={modal.mode}
          account={modal.account}
          tradingAccounts={tradingAccounts}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await handleSaved();
          }}
        />
      ) : null}
    </div>
  );
}
