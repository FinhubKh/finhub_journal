import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { accountTypeLabel } from '../../lib/accounts';

function Chevron({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-zinc-400 transition duration-150 ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-emerald-500">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OptionRow({ selected, onClick, title, subtitle, trailing }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
        selected
          ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
          : 'text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/70'
      }`}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${selected ? 'font-semibold' : 'font-medium'}`}>
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {selected ? <CheckIcon /> : null}
      </span>
    </button>
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
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const isPortfolio = viewMode === 'portfolio';
  const title = isPortfolio ? 'Portfolio' : activeAccount?.name || 'Account';
  const subtitle = isPortfolio
    ? 'All accounts'
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
    navigate('/dashboard/accounts');
  }

  const toolbar = variant === 'toolbar';
  const sidebar = variant === 'sidebar';

  const triggerClass = sidebar
    ? `flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-xs font-medium transition dark:bg-zinc-900 ${
        open
          ? 'border-zinc-300 dark:border-zinc-600'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
      }`
    : toolbar
      ? `inline-flex h-10 w-full items-center justify-between gap-2 rounded-full border border-zinc-200/90 bg-white/90 px-5 text-left text-[13px] shadow-sm shadow-zinc-900/5 backdrop-blur-sm transition hover:bg-zinc-50 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/30 dark:hover:bg-zinc-800/80 ${
          open ? 'bg-zinc-50 dark:bg-zinc-800/80' : ''
        }`
      : `flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-1.5 text-left text-xs font-medium transition dark:bg-zinc-900 ${
          open
            ? 'border-zinc-300 dark:border-zinc-600'
            : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`;

  return (
    <div
      className={`relative ${sidebar ? 'w-full' : toolbar ? 'w-full min-w-[16rem] max-w-sm sm:min-w-[18rem]' : 'w-[240px]'}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">{title}</span>
          {!toolbar && subtitle ? (
            <span className="font-normal text-zinc-400"> · {subtitle}</span>
          ) : null}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          className={`absolute z-[80] mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40 ${
            sidebar ? 'left-0 right-0' : toolbar ? 'left-0 right-0 w-full' : 'right-0 w-[240px]'
          }`}
          role="listbox"
          aria-label="Account view"
        >
          <OptionRow
            selected={isPortfolio}
            onClick={pickPortfolio}
            title="Portfolio"
            subtitle="All accounts combined"
          />

          {tradingAccounts.length > 0 && (
            <div className="mt-0.5 border-t border-zinc-100 pt-0.5 dark:border-zinc-800">
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                Accounts
              </p>
              <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                {tradingAccounts.map((a) => {
                  const selected = !isPortfolio && activeAccountId === a.id;
                  return (
                    <OptionRow
                      key={a.id}
                      selected={selected}
                      onClick={() => pickAccount(a.id)}
                      title={a.name}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-0.5 border-t border-zinc-100 pt-0.5 dark:border-zinc-800">
            <button
              type="button"
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={goManage}
            >
              Manage accounts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
