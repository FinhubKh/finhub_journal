import { useEffect, useState } from 'react';
import { deleteDailyPnl, upsertDailyPnl } from '../../api';
import { btnDanger, btnGhost, btnPrimary, card, input } from '../../lib/ui';

function fmtPnl(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`;
}

export default function DailyPnlModal({
  date,
  tradesSum,
  tradeCount = 0,
  override,
  onClose,
  onSaved,
}) {
  const [pnlInput, setPnlInput] = useState('');
  const [countInput, setCountInput] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hasOverride = Boolean(override);
  const syncedCount = tradeCount;

  useEffect(() => {
    const initialPnl = hasOverride ? override.pnl_usd : tradesSum;
    const roundedPnl = typeof initialPnl === 'number' ? Number(initialPnl.toFixed(2)) : Number(Number(initialPnl).toFixed(2));
    setPnlInput(roundedPnl === 0 && !hasOverride && syncedCount === 0 ? '' : String(roundedPnl));

    const initialCount = hasOverride
      ? (override.trade_count != null ? override.trade_count : syncedCount)
      : syncedCount;
    setCountInput(hasOverride || syncedCount > 0 ? String(initialCount) : '');

    setNotes(override?.notes || '');
    setError('');
  }, [date, override, tradesSum, hasOverride, syncedCount]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  async function handleSave(e) {
    e.preventDefault();
    const rawPnl = pnlInput.trim();
    const rawCount = countInput.trim();

    if (rawPnl === '') {
      setError('Enter a PnL amount.');
      return;
    }
    if (rawCount === '') {
      setError('Enter the number of trades.');
      return;
    }

    const pnl = parseFloat(rawPnl);
    const trade_count = parseInt(rawCount, 10);
    if (Number.isNaN(pnl)) {
      setError('Enter a valid PnL number.');
      return;
    }
    if (Number.isNaN(trade_count) || trade_count < 0) {
      setError('Trade count must be 0 or greater.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await upsertDailyPnl({ date, pnl_usd: pnl, trade_count, notes });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save daily entry.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!hasOverride) return;
    setBusy(true);
    setError('');
    try {
      await deleteDailyPnl(date);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not reset daily entry.');
    } finally {
      setBusy(false);
    }
  }

  const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => { if (!busy) onClose(); }}
    >
      <div
        className={`${card} w-full max-w-md shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-pnl-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 id="daily-pnl-title" className="text-base font-semibold text-zinc-900">Edit day</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
          </div>
          <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Close</button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSave}>
          {syncedCount > 0 && (
            <p className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Synced: <strong className="font-semibold text-zinc-800">{syncedCount} trade{syncedCount !== 1 ? 's' : ''}</strong>
              {' · '}
              <strong className="font-semibold text-zinc-800">{fmtPnl(tradesSum)}</strong>
              {hasOverride ? ' — values below override the calendar.' : ''}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="daily-pnl-input">
                PnL (USD)
              </label>
              <input
                id="daily-pnl-input"
                className={input}
                type="number"
                step="0.01"
                placeholder="e.g. 125.50"
                value={pnlInput}
                onChange={(e) => setPnlInput(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="daily-trade-count">
                Trades
              </label>
              <input
                id="daily-trade-count"
                className={input}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 3"
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700" htmlFor="daily-pnl-notes">
              Notes (optional)
            </label>
            <input
              id="daily-pnl-notes"
              className={input}
              placeholder="e.g. Prop firm payout day"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex flex-wrap justify-between gap-2 border-t border-zinc-100 pt-4">
            {hasOverride ? (
              <button className={btnDanger} type="button" disabled={busy} onClick={handleReset}>
                Reset to synced
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Cancel</button>
              <button className={btnPrimary} type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
