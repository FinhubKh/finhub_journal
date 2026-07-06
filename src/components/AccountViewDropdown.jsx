import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { accountTypeLabel } from '../lib/accounts';

function Chevron({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-zinc-400 transition ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AccountViewDropdown({ variant = 'header' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const {
    tradingAccounts,
    viewMode,
    activeAccountId,
    activeAccount,
    setViewMode,
    setActiveAccountId,
  } = useAppData();

  useEffect(() => {
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const isPortfolio = viewMode === 'portfolio';
  const title = isPortfolio ? 'Portfolio' : activeAccount?.name || 'Account';
  const subtitle = isPortfolio
    ? 'all accounts'
    : activeAccount
      ? accountTypeLabel(activeAccount.account_type)
      : null;

  function pickPortfolio() {
    setViewMode('portfolio');
    setOpen(false);
  }

  function pickAccount(id) {
    setActiveAccountId(id);
    setOpen(false);
  }

  function goManage() {
    setOpen(false);
    navigate('/dashboard', { state: { tab: 'settings', section: 'trading-accounts' } });
  }

  const triggerClass =
    variant === 'sidebar'
      ? 'flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-xs font-medium text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50/50'
      : 'inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50/40';

  return (
    <div className={`relative ${variant === 'sidebar' ? 'w-full' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">
          <span className="text-zinc-800">{title}</span>
          {subtitle ? <span className="font-normal text-zinc-400"> · {subtitle}</span> : null}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg shadow-zinc-900/10 ${
            variant === 'sidebar' ? 'left-0 right-0' : 'right-0 w-64'
          }`}
          role="listbox"
        >
          <button
            type="button"
            role="option"
            aria-selected={isPortfolio}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-50 ${
              isPortfolio ? 'bg-violet-50 text-violet-800' : 'text-zinc-700'
            }`}
            onClick={pickPortfolio}
          >
            <span className="flex h-2 w-2 shrink-0 rounded-full bg-violet-500" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Portfolio</span>
              <span className="block text-xs text-zinc-500">All accounts combined</span>
            </span>
          </button>

          {tradingAccounts.length > 0 && (
            <>
              <div className="my-1 border-t border-zinc-100" />
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Trading accounts
              </p>
              {tradingAccounts.map((a) => {
                const selected = !isPortfolio && activeAccountId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-zinc-50 ${
                      selected ? 'bg-violet-50 text-violet-800' : 'text-zinc-700'
                    }`}
                    onClick={() => pickAccount(a.id)}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: a.color || '#7c3aed' }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="block text-xs text-zinc-500">{accountTypeLabel(a.account_type)}</span>
                    </span>
                  </button>
                );
              })}
            </>
          )}

          <div className="my-1 border-t border-zinc-100" />
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs font-medium text-violet-600 transition hover:bg-violet-50"
            onClick={goManage}
          >
            Manage accounts
          </button>
        </div>
      )}
    </div>
  );
}
