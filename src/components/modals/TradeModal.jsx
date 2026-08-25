import { useEffect, useState } from 'react';
import { useTradeModal } from '../../context/TradeModalContext';
import { useAppData } from '../../context/AppDataContext';
import { useDialog } from '../../context/DialogContext';
import { deleteTrade, updateTradeAnnotation } from '../../api';
import { fmtPnlStrict, fmtDateLong, fmtTradeR, tradeRValue } from '../../lib/format';
import { tradePnlDenomination } from '../../lib/accounts';
import CustomDropdown from '../common/CustomDropdown';
import TradeScreenshots from '../journal/TradeScreenshots';
import {
  btnDanger, btnGhost, btnPrimaryFull, card, input, label, msgError, msgSuccess, tradeResultBadge,
} from '../../lib/ui';

export default function TradeModal() {
  const { trade, close } = useTradeModal();
  const { refreshTrades, resolveTradeAccount, journalStats } = useAppData();
  const { alert, confirm } = useDialog();

  const [session, setSession] = useState('');
  const [rVal, setRVal] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [annMsg, setAnnMsg] = useState(null);

  useEffect(() => {
    if (trade) {
      setSession(trade.session || '');
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
  const isManual = !isApi;
  const denomination = tradePnlDenomination(t, resolveTradeAccount);
  const r = tradeRValue(t, journalStats?.avgLoss);
  const rDisplay = fmtTradeR(t, journalStats?.avgLoss);
  const pnlDisplay = fmtPnlStrict(t.pnl_usd, denomination);
  const pnlClass = (t.pnl_usd || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const rClass = (r || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : (r || 0) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100';

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete trade?',
      message: 'This trade and its screenshots will be removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTrade(t.id);
      close();
      await refreshTrades();
    } catch (e) {
      await alert({ title: 'Error', message: 'Could not delete trade.' });
    }
  }

  async function saveAnnotation() {
    setSaving(true); setAnnMsg(null);
    try {
      await updateTradeAnnotation(t.id, {
        r_value: rVal !== '' ? parseFloat(rVal) : null,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-4 sm:items-center"
      id="trade-modal"
      onClick={(e) => { if (e.target.id === 'trade-modal') close(); }}
    >
      <div className={`${card} max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 py-3.5 md:px-5">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Trade Detail</div>
          <button className={btnGhost} onClick={close} type="button">Close</button>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            <span className={tradeResultBadge(t.result)}>{t.result}</span>
            {isApi && <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">API</span>}
            {isManual && <span className="rounded-md bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">Manual</span>}
            {t.account && <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">{t.account}</span>}
            {t.session && <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-300">{t.session}</span>}
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500">{fmtDateLong(t.date)}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">R Value</div>
              <div className={`mt-1 text-lg font-bold ${rClass}`}>{rDisplay}</div>
            </div>
            <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-3">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">PnL (USD)</div>
              <div className={`mt-1 text-lg font-bold ${pnlClass}`}>{pnlDisplay}</div>
            </div>
          </div>

          {isApi && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Synced from MT4/5</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-zinc-500 dark:text-zinc-400">Symbol</span><div className="font-medium text-zinc-900 dark:text-zinc-100">{t.symbol || '—'}</div></div>
                <div><span className="text-zinc-500 dark:text-zinc-400">Direction</span><div className="font-medium text-zinc-900 dark:text-zinc-100">{(t.direction || '—').toUpperCase()}</div></div>
                <div><span className="text-zinc-500 dark:text-zinc-400">Entry</span><div className="font-medium text-zinc-900 dark:text-zinc-100">{t.entry_price != null ? Number(t.entry_price).toFixed(2) : '—'}</div></div>
                <div><span className="text-zinc-500 dark:text-zinc-400">Exit</span><div className="font-medium text-zinc-900 dark:text-zinc-100">{t.exit_price != null ? Number(t.exit_price).toFixed(2) : '—'}</div></div>
                <div><span className="text-zinc-500 dark:text-zinc-400">Lot Size</span><div className="font-medium text-zinc-900 dark:text-zinc-100">{t.lot_size ?? '—'}</div></div>
                <div><span className="text-zinc-500 dark:text-zinc-400">Ticket</span><div className="font-medium text-zinc-900 dark:text-zinc-100">{t.ticket ?? '—'}</div></div>
              </div>
            </div>
          )}

          {(isApi || isManual) && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {isManual ? 'Journal details' : 'Your journal entry'}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Session</label>
                  <CustomDropdown
                    className="w-full"
                    menuClassName="w-full"
                    value={session}
                    onChange={setSession}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'asian', label: 'Asian' },
                      { value: 'london', label: 'London' },
                      { value: 'ny', label: 'New York' },
                    ]}
                  />
                </div>
                <div>
                  <label className={label}>R Value</label>
                  <input className={input} type="number" step="0.1" placeholder="0.0" value={rVal} onChange={(e) => setRVal(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Notes / Reasoning / Emotion</label>
                  <textarea
                    className={`${input} resize-none`}
                    rows="3"
                    placeholder="Why did you enter? How did you feel?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <button className={btnPrimaryFull} type="button" disabled={saving} onClick={saveAnnotation}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              {annMsg && <p className={annMsg.type === 'error' ? msgError : msgSuccess}>{annMsg.text}</p>}
            </>
          )}

          {isManual && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <TradeScreenshots tradeId={t.id} enabled />
            </div>
          )}
        </div>

        {isManual && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 md:p-5">
            <button className={`${btnDanger} w-full`} type="button" onClick={handleDelete}>Delete this trade</button>
          </div>
        )}
      </div>
    </div>
  );
}
