import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { btnDanger, btnGhost, btnPrimary, card } from '../lib/ui';

const DialogContext = createContext(null);

function WarningIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function AppDialog({ dialog, onClose }) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!dialog) return;
    document.body.style.overflow = 'hidden';
    const focusEl = dialog.type === 'confirm' ? cancelRef : confirmRef;
    focusEl.current?.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(dialog.type === 'confirm' ? false : undefined);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [dialog, onClose]);

  if (!dialog) return null;

  const isConfirm = dialog.type === 'confirm';
  const destructive = Boolean(dialog.destructive);
  const isDanger = dialog.tone === 'danger' || destructive;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => onClose(isConfirm ? false : undefined)}
    >
      <div
        className={`${card} w-full max-w-md overflow-hidden shadow-xl ${
          isDanger ? 'border-rose-200 dark:border-rose-900/60' : ''
        }`}
        role={isConfirm ? 'alertdialog' : 'alert'}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        {isDanger ? (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-4 dark:border-rose-900/40 dark:bg-rose-950/40">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                <WarningIcon />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 id="app-dialog-title" className="text-base font-semibold text-rose-700 dark:text-rose-300">
                  {dialog.title}
                </h2>
                <p id="app-dialog-message" className="mt-1.5 text-sm leading-relaxed text-rose-700/80 dark:text-rose-300/80">
                  {dialog.message}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 id="app-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {dialog.title}
              </h2>
            </div>
            <div className="px-5 py-4">
              <p id="app-dialog-message" className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {dialog.message}
              </p>
            </div>
          </>
        )}
        <div className={`flex flex-wrap justify-end gap-2 px-5 py-4 ${
          isDanger
            ? 'border-t border-rose-100 bg-white dark:border-rose-900/40 dark:bg-zinc-950'
            : 'border-t border-zinc-100 dark:border-zinc-800'
        }`}
        >
          {isConfirm && (
            <button
              ref={cancelRef}
              type="button"
              className={btnGhost}
              onClick={() => onClose(false)}
            >
              {dialog.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={isDanger ? btnDanger : btnPrimary}
            onClick={() => onClose(isConfirm ? true : undefined)}
          >
            {dialog.confirmLabel || (isConfirm ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    setDialog(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(result);
  }, []);

  const alert = useCallback(({ title = 'Notice', message, confirmLabel = 'OK', tone } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      setDialog({ type: 'alert', title, message, confirmLabel, tone });
    });
  }, []);

  const confirm = useCallback(({
    title = 'Are you sure?',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({ type: 'confirm', title, message, confirmLabel, cancelLabel, destructive });
    });
  }, []);

  const value = { alert, confirm };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AppDialog dialog={dialog} onClose={close} />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
