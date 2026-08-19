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
  const isProfitable = pnl >= 0;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/50 bg-white/60 p-5 min-h-[280px] shadow-sm backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:border-violet-500/50 hover:bg-white/80 hover:shadow-xl hover:shadow-violet-500/10 dark:border-zinc-800/50 dark:bg-zinc-900/60 dark:hover:border-violet-500/40 dark:hover:bg-zinc-900/80">
      
      {/* Decorative Blur Orbs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl transition-opacity duration-500 group-hover:bg-violet-500/20" />
      <div className={`pointer-events-none absolute -bottom-20 -left-20 h-32 w-32 rounded-full blur-3xl transition-opacity duration-500 ${hasUpload ? (isProfitable ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-rose-500/10 group-hover:bg-rose-500/20') : 'bg-amber-500/10 group-hover:bg-amber-500/20'}`} />

      {/* Top Accent Gradient Line */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-60 transition-opacity duration-500 group-hover:opacity-100 ${
        !hasUpload ? 'from-amber-400 via-amber-500 to-orange-500' :
        isProfitable ? 'from-emerald-400 via-emerald-500 to-teal-500' :
        'from-rose-400 via-rose-500 to-red-500'
      }`} />

      {/* Header Info */}
      <div className="relative z-10">
        {/* Plan Title */}
        <h2 className="truncate text-lg font-bold tracking-tight text-zinc-900 transition-colors dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300">
          {row.name}
        </h2>
        
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {row.report_symbol || 'No symbol'}
          </span>
          {hasUpload && (
            <>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span className="truncate">{row.range_from} &rarr; {row.range_to}</span>
            </>
          )}
        </div>

        {/* PnL and Trades Box */}
        {hasUpload ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/40 bg-white/40 p-4 shadow-inner backdrop-blur-md dark:border-zinc-700/40 dark:bg-zinc-800/40">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Net Profit</div>
                <div className={`mt-0.5 flex items-baseline gap-1 text-2xl font-bold tabular-nums tracking-tight ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fmtPnlStrict(pnl, curr)}
                </div>
              </div>
              <div className="h-px bg-zinc-200/50 dark:bg-zinc-700/50" />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Trades</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
                  {row.trade_count}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex h-[64px] items-center justify-center rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 transition-colors group-hover:bg-amber-500/10 dark:border-amber-500/20 dark:bg-amber-500/5 dark:group-hover:bg-amber-500/10">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600/80 dark:text-amber-400/80">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload MT5 Report
            </p>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-200 before:to-transparent dark:before:via-zinc-800">
        <button
          type="button"
          className="group/btn relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 dark:bg-white dark:text-zinc-900 dark:hover:bg-violet-500 dark:hover:text-white"
          onClick={onOpen}
        >
          <span className="relative z-10 flex items-center gap-1.5">
            Open Strategy
            <svg className="h-3 w-3 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className="group/del flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-zinc-200/80 bg-white/50 text-zinc-400 shadow-sm transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:border-zinc-700/80 dark:bg-zinc-800/50 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete Strategy"
        >
          <svg className="h-4 w-4 transition-transform duration-300 group-hover/del:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

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

  const leaderboardSorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pnlA = Number(a.total_pnl) || 0;
      const pnlB = Number(b.total_pnl) || 0;
      return pnlB - pnlA;
    });
  }, [rows]);

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
              Strategy Lab
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Create a strategy, then open it to upload an MT5 HTML report to analyze your performance.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-xl border border-zinc-200/60 bg-zinc-50/50 p-1 dark:border-zinc-800/60 dark:bg-zinc-900/50">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Leaderboard
            </button>
          </div>

          <button className={btnPrimary} type="button" onClick={() => setShowCreate(true)}>
            + Add Strategy
          </button>
        </div>
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
      ) : viewMode === 'table' ? (
        <div className="min-h-0 flex-1 overflow-x-auto rounded-2xl border border-zinc-200/60 bg-white/50 shadow-sm backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/50">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="sticky top-0 z-10 border-b border-zinc-200/80 bg-zinc-50/80 backdrop-blur-md text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-800/80 dark:text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Rank</th>
                <th className="px-6 py-4 font-semibold">Strategy Name</th>
                <th className="px-6 py-4 font-semibold">Symbol & Range</th>
                <th className="px-6 py-4 font-semibold text-right">Win Rate</th>
                <th className="px-6 py-4 font-semibold text-right">Profit Factor</th>
                <th className="px-6 py-4 font-semibold text-right">Trades</th>
                <th className="px-6 py-4 font-semibold text-right">Net Profit</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50">
              {leaderboardSorted.map((r, i) => {
                const hasUpload = r.range_from && r.range_to && (Number(r.trade_count) || 0) > 0;
                const curr = r.currency === 'cent' ? 'cent' : 'usd';
                const pnl = Number(r.total_pnl) || 0;
                const isProfitable = pnl >= 0;
                const totalCompleted = (Number(r.wins) || 0) + (Number(r.losses) || 0) + (Number(r.be_count) || 0);
                const winRate = totalCompleted > 0 ? ((Number(r.wins) || 0) / totalCompleted) * 100 : 0;
                const pf = r.profit_factor !== null ? Number(r.profit_factor).toFixed(2) : null;

                return (
                  <tr key={r.id} className="group transition-colors hover:bg-white dark:hover:bg-zinc-800/40">
                    <td className="px-6 py-4 font-medium text-zinc-400 dark:text-zinc-500">#{i + 1}</td>
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => navigate(`/dashboard/backtests/${r.id}`)} className="text-left font-bold text-zinc-900 transition-colors hover:text-violet-600 dark:text-zinc-100 dark:hover:text-violet-400">
                        {r.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {hasUpload ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{r.report_symbol}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{r.range_from} &rarr; {r.range_to}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-600/80 dark:text-amber-400/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Awaiting Data
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasUpload ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-bold ${winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {winRate.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-zinc-400">{r.wins}W / {r.losses}L</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasUpload ? (
                        <span className={`font-bold tabular-nums ${pf === null ? 'text-zinc-400' : pf >= 1.5 ? 'text-emerald-600 dark:text-emerald-400' : pf >= 1.0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {pf !== null ? pf : 'N/A'}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                      {hasUpload ? r.trade_count : '-'}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold tabular-nums ${hasUpload ? (isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-zinc-400'}`}>
                      {hasUpload ? fmtPnlStrict(pnl, curr) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="opacity-0 transition-all group-hover:opacity-100 text-zinc-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        title="Delete Strategy"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
