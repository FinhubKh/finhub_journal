import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createBacktest, deleteBacktest, listBacktests } from '../api/backtests';
import DeleteConfirmModal from '../components/modals/DeleteConfirmModal';
import { fmtPnlStrict } from '../lib/format';
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  card,
  cardBody,
  cardHd,
  cardTitle,
  dashboardPageWide,
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
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-4">
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
    <div className={dashboardPageWide}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Strategies</h1>
          <p className="text-sm text-zinc-500">
            Create a strategy, then upload the MT5 HTML report in its detail page.
          </p>
        </div>
        <button className={btnPrimary} type="button" onClick={() => setShowCreate(true)}>
          + Add strategy
        </button>
      </div>

      {error ? (
        <div className={`${card} ${cardBody} mb-4`}>
          <p className={msgError}>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className={`${card} ${cardBody} text-center text-sm text-zinc-400`}>Loading…</div>
      ) : sorted.length === 0 ? (
        <div className={`${card} ${cardBody} text-center`}>
          <p className="text-sm text-zinc-500">No strategies yet.</p>
          <button className={`${btnPrimary} mt-3`} type="button" onClick={() => setShowCreate(true)}>
            + Create your first strategy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((r) => {
            const hasUpload = r.range_from && r.range_to && (Number(r.trade_count) || 0) > 0;
            const curr = r.currency === 'cent' ? 'cent' : 'usd';
            return (
              <div
                key={r.id}
                className={`${card} flex flex-col justify-between p-4 transition hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer`}
                onClick={() => navigate(`/dashboard/backtests/${r.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/dashboard/backtests/${r.id}`); }}
              >
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{r.name}</h3>
                  {r.report_symbol ? (
                    <p className="mt-0.5 text-xs text-zinc-500">{r.report_symbol}</p>
                  ) : null}
                </div>

                {hasUpload ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-400">PnL</div>
                      <div className={`text-sm font-bold ${Number(r.total_pnl) >= 0 ? 'text-violet-600' : 'text-rose-600'}`}>
                        {fmtPnlStrict(r.total_pnl, curr)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-400">Trades</div>
                      <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{r.trade_count}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-400">Range</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-300">{r.range_from} → {r.range_to}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    Upload pending — click to add report
                  </div>
                )}

                <div className="mt-3 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`${btnGhost} !py-1.5 !px-3 text-xs`}
                    type="button"
                    onClick={() => navigate(`/dashboard/backtests/${r.id}`)}
                  >
                    {hasUpload ? 'View' : 'Upload'}
                  </button>
                  <button
                    className={`${btnDanger} !py-1.5 !px-3 text-xs`}
                    type="button"
                    onClick={() => setDeleteTarget(r)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
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
