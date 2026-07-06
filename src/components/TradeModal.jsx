import { useEffect, useState } from 'react';
import { useTradeModal } from '../context/TradeModalContext';
import { useAppData } from '../context/AppDataContext';
import { useDialog } from '../context/DialogContext';
import { deleteTrade, updateTradeAnnotation } from '../api';
import { fmtR, fmtPnl, fmtDateLong } from '../lib/format';
import {
  btnDanger, btnGhost, btnPrimaryFull, card, input, label, msgError, msgSuccess, tradeResultBadge,
} from '../lib/ui';

export default function TradeModal() {
  const { trade, close } = useTradeModal();
  const { userModels, refreshTrades } = useAppData();
  const { alert, confirm } = useDialog();

  const [session, setSession] = useState('');
  const [model, setModel] = useState('');
  const [rVal, setRVal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [annMsg, setAnnMsg] = useState(null);

  useEffect(() => {
    if (trade) {
      setSession(trade.session || '');
      setModel(trade.model || '');
      setRVal(trade.r_value ?? '');
      setNotes(trade.notes || '');
      setAnnMsg(null);
    }
  }, [trade]);

  useEffect(() => {
    document.body.style.overflow = trade ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [trade]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  if (!trade) return null;

  const t = trade;
  const isApi = t.source === 'api';
  const rDisplay = t.r_value ? fmtR(t.r_value) : '—';
  const pnlDisplay = t.pnl_usd ? fmtPnl(t.pnl_usd) : '—';
  const pnlClass = t.pnl_usd >= 0 ? 'text-violet-600' : 'text-rose-600';

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete trade?',
      message: 'This trade will be removed from your journal permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try { await deleteTrade(t.id); close(); await refreshTrades(); }
    catch (e) {
      await alert({ title: 'Error', message: 'Could not delete trade.' });
    }
  }

  async function saveAnnotation() {
    setSaving(true); setAnnMsg(null);
    try {
      await updateTradeAnnotation(t.id, {
        r_value: rVal !== '' ? parseFloat(rVal) : null,
        model: model || null,
        session: session || null,
        notes: notes || null,
      });
      setAnnMsg({ text: 'Saved!', type: 'success' });
      await refreshTrades();
    } catch (e) {
      setAnnMsg({ text: 'Could not save.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      id="trade-modal"
      onClick={(e) => { if (e.target.id === 'trade-modal') close(); }}
    >
      <div className={`${card} max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-lg`}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5 md:px-5">
          <div className="text-sm font-semibold text-zinc-900">Trade Detail</div>
          <button className={btnGhost} onClick={close} type="button">Close</button>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            <span className={tradeResultBadge(t.result)}>{t.result}</span>
            {isApi && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">API</span>}
            {t.account && <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">{t.account}</span>}
            {!isApi && t.model && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t.model}</span>}
            {!isApi && t.session && <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">{t.session}</span>}
          </div>

          <p className="text-xs text-zinc-400">{fmtDateLong(t.date)}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">R Value</div>
              <div className={`mt-1 text-lg font-bold ${t.r_value > 0 ? 'text-violet-600' : t.r_value < 0 ? 'text-rose-600' : 'text-zinc-900'}`}>{rDisplay}</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">PnL (USD)</div>
              <div className={`mt-1 text-lg font-bold ${pnlClass}`}>{pnlDisplay}</div>
            </div>
          </div>

          {isApi && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Synced from MT4/5</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-500">Symbol</span><div className="font-medium">{t.symbol || '—'}</div></div>
                <div><span className="text-zinc-500">Direction</span><div className="font-medium">{(t.direction || '—').toUpperCase()}</div></div>
                <div><span className="text-zinc-500">Entry</span><div className="font-medium">{t.entry_price != null ? Number(t.entry_price).toFixed(2) : '—'}</div></div>
                <div><span className="text-zinc-500">Exit</span><div className="font-medium">{t.exit_price != null ? Number(t.exit_price).toFixed(2) : '—'}</div></div>
                <div><span className="text-zinc-500">Lot Size</span><div className="font-medium">{t.lot_size ?? '—'}</div></div>
                <div><span className="text-zinc-500">Ticket</span><div className="font-medium">{t.ticket ?? '—'}</div></div>
              </div>
            </div>
          )}

          {!isApi && t.notes && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Notes</div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{t.notes}</p>
            </div>
          )}

          {isApi && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Your journal entry</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Session</label>
                  <select className={input} value={session} onChange={(e) => setSession(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="asian">Asian</option>
                    <option value="london">London</option>
                    <option value="ny">New York</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Model</label>
                  <select className={input} value={model} onChange={(e) => setModel(e.target.value)}>
                    <option value="">Select...</option>
                    {userModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>R Value</label>
                  <input className={input} type="number" step="0.1" placeholder="0.0" value={rVal} onChange={(e) => setRVal(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Notes / Reasoning / Emotion</label>
                  <textarea className={`${input} resize-none`} rows="3" placeholder="Why did you enter? How did you feel?"
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <button className={btnPrimaryFull} type="button" disabled={saving} onClick={saveAnnotation}>
                {saving ? 'Saving...' : 'Save Annotation'}
              </button>
              {annMsg && <p className={annMsg.type === 'error' ? msgError : msgSuccess}>{annMsg.text}</p>}
            </>
          )}
        </div>

        {!isApi && (
          <div className="border-t border-zinc-100 p-4 md:p-5">
            <button className={`${btnDanger} w-full`} type="button" onClick={handleDelete}>Delete this trade</button>
          </div>
        )}
      </div>
    </div>
  );
}
