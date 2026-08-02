import { useEffect } from 'react';
import { card } from '../../lib/ui';

/**
 * Blocking loading overlay shown while investor MT5 sync is in progress.
 */
export default function SyncLoadingModal({ open, accountName }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="sync-loading-title"
      aria-describedby="sync-loading-message"
    >
      <div className={`${card} w-full max-w-sm shadow-xl dark:bg-zinc-900`}>
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <span
            className="mb-5 inline-block h-11 w-11 animate-spin rounded-full border-[3px] border-zinc-200 border-t-violet-600 dark:border-zinc-700 dark:border-t-emerald-400"
            aria-hidden
          />
          <h2
            id="sync-loading-title"
            className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            Syncing MT5 trades
          </h2>
          <p
            id="sync-loading-message"
            className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
          >
            {accountName
              ? `Pulling closed trades for “${accountName}”. This can take a moment.`
              : 'Pulling closed trades from MetaTrader 5. This can take a moment.'}
          </p>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Please wait — do not close this page
          </p>
        </div>
      </div>
    </div>
  );
}
