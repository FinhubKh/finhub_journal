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
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-violet-600">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PortfolioIcon({ active }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        active ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-500'
      }`}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="8.5" y="2" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="2" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </span>
  );
}

function AccountSwatch({ color, name, selected }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm ring-2 ${
        selected ? 'ring-violet-300' : 'ring-transparent'
      }`}
      style={{ backgroundColor: color || '#7c3aed' }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function OptionRow({ selected, onClick, leading, title, subtitle }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${
        selected
          ? 'bg-violet-50 text-violet-900'
          : 'text-zinc-800 hover:bg-zinc-50'
      }`}
      onClick={onClick}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${selected ? 'font-semibold text-violet-800' : 'font-medium text-zinc-900'}`}>
          {title}
        </span>
        {subtitle ? (
          <span className={`block truncate text-xs ${selected ? 'text-violet-600/80' : 'text-zinc-500'}`}>
            {subtitle}
          </span>
        ) : null}
      </span>
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
      ? `flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-xs font-medium transition ${
          open
            ? 'border-violet-300 bg-violet-50/60 text-violet-800 shadow-sm shadow-violet-500/10'
            : 'border-zinc-200 text-zinc-700 hover:border-violet-200 hover:bg-violet-50/40'
        }`
      : `inline-flex max-w-full items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-xs font-semibold transition ${
          open
            ? 'border-violet-400 text-violet-800 shadow-sm shadow-violet-500/10'
            : 'border-zinc-200 text-zinc-600 hover:border-violet-300 hover:bg-violet-50/50'
        }`;

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
          <span className="text-zinc-900">{title}</span>
          {subtitle ? <span className="font-normal text-zinc-400"> · {subtitle}</span> : null}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-xl shadow-zinc-900/10 ring-1 ring-zinc-900/5 ${
            variant === 'sidebar' ? 'left-0 right-0' : 'right-0 w-[280px]'
          }`}
          role="listbox"
          aria-label="Account view"
        >
          <OptionRow
            selected={isPortfolio}
            onClick={pickPortfolio}
            leading={<PortfolioIcon active={isPortfolio} />}
            title="Portfolio"
            subtitle="All accounts combined"
          />

          {tradingAccounts.length > 0 && (
            <div className="mt-1 border-t border-zinc-100 pt-1">
              <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Trading accounts
              </p>
              <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                {tradingAccounts.map((a) => {
                  const selected = !isPortfolio && activeAccountId === a.id;
                  return (
                    <OptionRow
                      key={a.id}
                      selected={selected}
                      onClick={() => pickAccount(a.id)}
                      leading={<AccountSwatch color={a.color} name={a.name} selected={selected} />}
                      title={a.name}
                      subtitle={accountTypeLabel(a.account_type)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-1 border-t border-zinc-100 pt-1">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-violet-700 transition hover:bg-violet-50"
              onClick={goManage}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M2.5 8h11M8 2.5v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              Manage accounts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
