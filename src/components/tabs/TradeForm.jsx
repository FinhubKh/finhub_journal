import { useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { insertTrade } from '../../lib/api';

const today = () => new Date().toISOString().split('T')[0];

export default function TradeForm() {
  const { userModels, refreshTrades } = useAppData();
  const [date, setDate] = useState(today());
  const [session, setSession] = useState('');
  const [model, setModel] = useState('');
  const [result, setResult] = useState(null);
  const [rVal, setRVal] = useState('');
  const [pnl, setPnl] = useState('');
  const [notes, setNotes] = useState('');
  const [account, setAccount] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  function reset() {
    setDate(today()); setSession(''); setModel(''); setResult(null);
    setRVal(''); setPnl(''); setNotes(''); setAccount('');
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
      await insertTrade({
        date, result,
        r_value: rVal !== '' ? parseFloat(rVal) : 0,
        pnl_usd: pnl !== '' ? parseFloat(pnl) : 0,
        notes: notes.trim() || null,
        model: model || null,
        session: session || null,
        account: account.trim() || null,
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
    <div className="card">
      <div className="card-hd">
        <h3 className="card-title">Log a Trade</h3>
        <div className="db-status">
          <span className="db-dot connected" />
          <span className="db-text">Connected</span>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Session</label>
          <select className="form-input" value={session} onChange={(e) => setSession(e.target.value)}>
            <option value="">Select...</option>
            <option value="asian">Asian</option>
            <option value="london">London</option>
            <option value="ny">New York</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Model</label>
          <select className="form-input" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Select...</option>
            {userModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Result</label>
          <div className="result-btns">
            {['win', 'loss', 'be'].map((v) => (
              <button key={v} type="button" className={`result-btn ${v} ${result === v ? 'selected' : ''}`}
                onClick={() => setResult(v)}>
                {v === 'win' ? 'Win' : v === 'loss' ? 'Loss' : 'BE'}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">R Value <span className="form-hint">(e.g. 2.0 or -1.0)</span></label>
          <input className="form-input" type="number" step="0.1" placeholder="0.0" value={rVal} onChange={(e) => setRVal(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">PnL (USD) <span className="form-hint">(e.g. 120 or -60)</span></label>
          <input className="form-input" type="number" step="0.01" placeholder="0.00" value={pnl} onChange={(e) => setPnl(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label className="form-label">Notes</label>
          <textarea className="form-input form-textarea" rows="3" placeholder="What happened? Why did you take this trade?"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="form-group form-group--full">
          <label className="form-label">Account <span className="form-hint">(e.g. FTMO, Personal, Challenge)</span></label>
          <input className="form-input" type="text" placeholder="Leave blank if only one account" value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
      </div>
      <button className="submit-btn" type="button" disabled={saving} onClick={submit}>
        <span>{saving ? 'Saving...' : 'Save Trade'}</span>
      </button>
      {msg && <div className={`form-msg ${msg.type}`}>{msg.text}</div>}
    </div>
  );
}
