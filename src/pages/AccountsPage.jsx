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
      className={`${card} group relative w-full overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:hover:border-emerald-700`}
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
            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition hover:bg-violet-100 hover:text-violet-600 dark:bg-zinc-800 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
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
      <header className="mb-6 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-emerald-400">
            Trading desk
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Accounts
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Edit or delete accounts here, or open one to manage EA sync and investor password.
          </p>
        </div>
        <button className={btnPrimary} type="button" onClick={() => setModal({ mode: 'add' })}>
          Add account
        </button>
      </header>

      {tradingAccounts.length === 0 ? (
        <div className={`${card} ${emptyState} py-16`}>
          <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">No trading accounts yet</p>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">
            Create an account, then connect MT5 with an EA sync key or an investor password.
          </p>
          <button className={`${btnOutline} mt-5`} type="button" onClick={() => setModal({ mode: 'add' })}>
            Add your first account
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
