import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { btnDanger, btnGhost, btnPrimary, card } from '../lib/ui';

const DialogContext = createContext(null);

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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => onClose(isConfirm ? false : undefined)}
    >
      <div
        className={`${card} w-full max-w-md shadow-xl`}
        role={isConfirm ? 'alertdialog' : 'alert'}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 id="app-dialog-title" className="text-base font-semibold text-zinc-900">
            {dialog.title}
          </h2>
        </div>
        <div className="px-5 py-4">
          <p id="app-dialog-message" className="text-sm leading-relaxed text-zinc-600">
            {dialog.message}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-5 py-4">
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
            className={destructive ? btnDanger : btnPrimary}
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

  const alert = useCallback(({ title = 'Notice', message, confirmLabel = 'OK' }) => {
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      setDialog({ type: 'alert', title, message, confirmLabel });
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
