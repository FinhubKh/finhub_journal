import { useEffect, useState, useMemo } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { insertTrade } from '../../api';
import { connectedTradingAccounts } from '../../lib/accounts';
import {
  btnPrimaryFull, card, cardBody, cardHd, cardTitle, input, label, msgError, msgSuccess, resultBtn,
} from '../../lib/ui';

const today = () => new Date().toISOString().split('T')[0];

export default function TradeForm() {
  const {
    userModels,
    tradingAccounts,
    activeAccount,
    viewMode,
    refreshTrades,
  } = useAppData();
  const [date, setDate] = useState(today());
  const [session, setSession] = useState('');
  const [model, setModel] = useState('');
  const [result, setResult] = useState(null);
  const [rVal, setRVal] = useState('');
  const [pnl, setPnl] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const linkedAccounts = useMemo(
    () => connectedTradingAccounts(tradingAccounts),
    [tradingAccounts],
  );

  useEffect(() => {
    if (viewMode === 'account' && activeAccount) {
      setAccountId(activeAccount.id);
    }
  }, [viewMode, activeAccount]);

  function reset() {
    setDate(today()); setSession(''); setModel(''); setResult(null);
    setRVal(''); setPnl(''); setNotes('');
    if (viewMode === 'account' && activeAccount) {
      setAccountId(activeAccount.id);
    } else {
      const def = linkedAccounts.find((a) => a.is_default) || linkedAccounts[0];
      setAccountId(def?.id || '');
    }
  }

  function flashMsg(text, type) {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  async function submit() {
    if (!date) return flashMsg('Please select a date.', 'error');
    if (!result) return flashMsg('Please select Win, Loss, or BE.', 'error');
    if (rVal === '' && pnl === '') return flashMsg('Please enter at least an R value or PnL.', 'error');
    setSaving(true);
    try {
      const selected = linkedAccounts.find((a) => a.id === accountId);
      await insertTrade({
        date, result,
        r_value: rVal !== '' ? parseFloat(rVal) : 0,
        pnl_usd: pnl !== '' ? parseFloat(pnl) : 0,
        notes: notes.trim() || null,
        model: model || null,
        session: session || null,
        account: selected?.name || null,
        account_id: selected?.id || null,
      });
      flashMsg('Trade saved!', 'success');
      reset();
      await refreshTrades();
    } catch (e) {
      flashMsg('Failed to save. Check your connection.', 'error');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className={cardHd}>
        <h3 className={cardTitle}>Log a Trade</h3>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          <span className="text-xs text-zinc-400">Connected</span>
        </div>
      </div>

      <div className={`${cardBody} grid grid-cols-1 gap-4 sm:grid-cols-2`}>
        <div>
          <label className={label}>Date</label>
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
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
          <label className={label}>Trading account</label>
          <select className={input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">No account</option>
            {linkedAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Result</label>
          <div className="flex gap-2">
            {['win', 'loss', 'be'].map((v) => (
              <button key={v} type="button" className={resultBtn(v, result === v)} onClick={() => setResult(v)}>
                {v === 'win' ? 'Win' : v === 'loss' ? 'Loss' : 'BE'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={label}>R Value <span className="font-normal text-zinc-400">(e.g. 2.0 or -1.0)</span></label>
          <input className={input} type="number" step="0.1" placeholder="0.0" value={rVal} onChange={(e) => setRVal(e.target.value)} />
        </div>
        <div>
          <label className={label}>PnL (USD) <span className="font-normal text-zinc-400">(e.g. 120 or -60)</span></label>
          <input className={input} type="number" step="0.01" placeholder="0.00" value={pnl} onChange={(e) => setPnl(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Notes</label>
          <textarea className={`${input} resize-none`} rows="3" placeholder="What happened? Why did you take this trade?"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="border-t border-zinc-100 px-4 pb-4 pt-2 md:px-5">
        <button className={btnPrimaryFull} type="button" disabled={saving} onClick={submit}>
          {saving ? 'Saving...' : 'Save Trade'}
        </button>
        {linkedAccounts.length === 0 && (
          <p className="mt-2 text-center text-xs text-zinc-400">
            Add a trading account in Settings to tag manual trades.
          </p>
        )}
        {msg && <p className={`mt-3 text-center ${msg.type === 'error' ? msgError : msgSuccess}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
