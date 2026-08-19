import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createBacktest, deleteBacktest, listBacktests } from '../api/backtests';
import DeleteConfirmModal from '../components/modals/DeleteConfirmModal';
import { fmtPnlStrict } from '../lib/format';
import {
  btnGhost,
  btnOutline,
  btnPrimary,
  card,
  dashboardPageWideFull,
  emptyState,
  input,
  msgError,
} from '../lib/ui';

function CreateStrategyModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  async function handleSubmit(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Please enter a strategy name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createBacktest({
        name: clean,
        currency: 'usd',
        reportMeta: {},
        dailyRows: [],
      });
      toast.success('Strategy created');
      onCreated(created);
    } catch (err) {
      setError(err?.message || 'Could not create strategy.');
    } finally {
      setBusy(false);
    }
  }

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
        aria-labelledby="create-strategy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 id="create-strategy-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            New strategy
          </h2>
          <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Close</button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="strategy-name-input">
              Strategy name
            </label>
            <input
              id="strategy-name-input"
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OneCERSIEntry - Run 1"
              autoFocus
            />
          </div>

          {error ? <p className={msgError}>{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button className={btnGhost} type="button" disabled={busy} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StrategyCard({ row, onOpen, onDelete }) {
  const hasUpload = row.range_from && row.range_to && (Number(row.trade_count) || 0) > 0;
  const curr = row.currency === 'cent' ? 'cent' : 'usd';
  const pnl = Number(row.total_pnl) || 0;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:border-violet-500/40">
      {/* Top Accent Gradient Border Glow on Hover */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
        !hasUpload ? 'from-amber-400 via-amber-500 to-orange-500' :
        pnl >= 0 ? 'from-emerald-400 via-emerald-500 to-teal-500' :
        'from-rose-400 via-rose-500 to-red-500'
      }`} />

      {/* Header Info */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            hasUpload
              ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${hasUpload ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {hasUpload ? 'Ready' : 'Awaiting Upload'}
          </span>
          {row.is_public && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
              Public
            </span>
          )}
        </div>

        {/* Plan Title */}
        <h2 className="mt-4 truncate text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
          {row.name}
        </h2>
        
        <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
          {row.report_symbol || 'No symbol yet'}
          {hasUpload ? ` · ${row.range_from} → ${row.range_to}` : ''}
        </p>

        {/* PnL and Trades Box */}
        {hasUpload ? (
          <div className="mt-4 rounded-xl bg-zinc-50/80 p-4 border border-zinc-100 dark:bg-zinc-800/50 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Net Profit</div>
                <div className={`mt-1 text-lg font-bold tabular-nums ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fmtPnlStrict(pnl, curr)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Trades</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {row.trade_count}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-zinc-200/80 bg-zinc-50/50 py-6 dark:border-zinc-800 dark:bg-zinc-800/30">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Click to upload MT5 report
            </p>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          onClick={onOpen}
        >
          Open Strategy
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          className="rounded-xl border border-zinc-200 px-3 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete Strategy"
        >
          <svg className="h-4 w-4 text-zinc-400 hover:text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function BacktestsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadList() {
    setLoading(true);
    setError('');
    try {
      const list = await listBacktests();
      setRows(list || []);
    } catch (err) {
      setError(err?.message || 'Could not load strategies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    [rows],
  );

  async function remove(id) {
    try {
      await deleteBacktest(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Strategy deleted');
    } catch (err) {
      toast.error(err?.message || 'Could not delete strategy.');
    }
  }

  return (
    <div className={dashboardPageWideFull}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Backtests
            </h1>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold text-violet-600 dark:text-violet-400">
              Strategy Lab
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Create a strategy, then open it to upload an MT5 HTML report to analyze your performance.
          </p>
        </div>
        <button className={btnPrimary} type="button" onClick={() => setShowCreate(true)}>
          + Add Strategy
        </button>
      </header>

      {error ? (
        <div className={`${card} mb-4 shrink-0 p-4`}>
          <p className={msgError}>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <span
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-zinc-700 dark:border-t-emerald-400"
            aria-hidden
          />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Loading strategies…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className={`${card} ${emptyState} flex min-h-0 flex-1 flex-col items-center justify-center py-16 text-center`}>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No strategies yet</h3>
          <p className="mx-auto mt-2 mb-8 max-w-sm text-sm text-zinc-500 text-center">
            Create a strategy first, then upload the Strategy Tester HTML from MetaTrader 5.
          </p>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => setShowCreate(true)}
          >
            + Create First Strategy
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((r) => (
              <StrategyCard
                key={r.id}
                row={r}
                onOpen={() => navigate(`/dashboard/backtests/${r.id}`)}
                onDelete={() => setDeleteTarget(r)}
              />
            ))}
          </div>
        </div>
      )}

      {showCreate ? (
        <CreateStrategyModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setShowCreate(false);
            navigate(`/dashboard/backtests/${created.id}`);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          message="This action cannot be undone. All imported data and charts for this backtest will be permanently removed."
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await remove(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
