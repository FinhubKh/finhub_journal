import { useEffect, useState } from 'react';
import { useTradeModal } from '../context/TradeModalContext';
import { useAppData } from '../context/AppDataContext';
import { deleteTrade, updateTradeAnnotation } from '../lib/api';
import { fmtR, fmtPnl, fmtDateLong } from '../lib/format';

export default function TradeModal() {
  const { trade, close } = useTradeModal();
  const { userModels, refreshTrades } = useAppData();

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

  if (!trade) {
    return <div className="modal-overlay" id="trade-modal"><div className="modal-sheet" /></div>;
  }

  const t = trade;
  const isApi = t.source === 'api';
  const rDisplay = t.r_value ? fmtR(t.r_value) : '—';
  const pnlDisplay = t.pnl_usd ? fmtPnl(t.pnl_usd) : '—';
  const pnlClass = t.pnl_usd >= 0 ? 'win-col' : 'loss-col';

  async function handleDelete() {
    if (!confirm('Delete this trade?')) return;
    try { await deleteTrade(t.id); close(); await refreshTrades(); }
    catch (e) { alert('Could not delete trade.'); }
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
    <div className="modal-overlay open" id="trade-modal" onClick={(e) => { if (e.target.id === 'trade-modal') close(); }}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-hd">
          <div className="modal-title">Trade Detail</div>
          <button className="modal-close" onClick={close} type="button">✕</button>
        </div>
        <div className="modal-body">
          <div className="detail-badge-row">
            <span className={`detail-badge ${t.result}`}>{t.result.toUpperCase()}</span>
            {isApi && <span className="detail-badge tag">🔒 API</span>}
            {t.account && <span className="detail-badge account">{t.account}</span>}
            {!isApi && t.model && <span className="detail-badge tag">{t.model}</span>}
            {!isApi && t.session && <span className="detail-badge tag">{t.session}</span>}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text4)', letterSpacing: '0.08em' }}>
            {fmtDateLong(t.date)}
          </div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-item-label">R Value</div>
              <div className={`detail-item-val ${t.r_value > 0 ? 'win-col' : t.r_value < 0 ? 'loss-col' : ''}`}>{rDisplay}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-label">PnL (USD)</div>
              <div className={`detail-item-val ${pnlClass}`}>{pnlDisplay}</div>
            </div>
          </div>

          {isApi && (
            <div className="detail-locked-box">
              <div className="detail-notes-label">🔒 Synced from MT4/5 — read-only</div>
              <div className="detail-grid">
                <div className="detail-item"><div className="detail-item-label">Symbol</div><div className="detail-item-val">{t.symbol || '—'}</div></div>
                <div className="detail-item"><div className="detail-item-label">Direction</div><div className="detail-item-val">{(t.direction || '—').toUpperCase()}</div></div>
                <div className="detail-item"><div className="detail-item-label">Entry</div><div className="detail-item-val">{t.entry_price != null ? Number(t.entry_price).toFixed(2) : '—'}</div></div>
                <div className="detail-item"><div className="detail-item-label">Exit</div><div className="detail-item-val">{t.exit_price != null ? Number(t.exit_price).toFixed(2) : '—'}</div></div>
                <div className="detail-item"><div className="detail-item-label">Lot Size</div><div className="detail-item-val">{t.lot_size ?? '—'}</div></div>
                <div className="detail-item"><div className="detail-item-label">Ticket</div><div className="detail-item-val">{t.ticket ?? '—'}</div></div>
              </div>
            </div>
          )}

          {!isApi && t.notes && (
            <div className="detail-notes-box">
              <div className="detail-notes-label">Notes</div>
              <div className="detail-notes-text">{t.notes}</div>
            </div>
          )}

          {isApi && (
            <>
              <div className="detail-notes-label" style={{ marginTop: 14 }}>Your journal entry</div>
              <div className="form-grid">
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
                  <label className="form-label">R Value</label>
                  <input className="form-input" type="number" step="0.1" placeholder="0.0" value={rVal} onChange={(e) => setRVal(e.target.value)} />
                </div>
                <div className="form-group form-group--full">
                  <label className="form-label">Notes / Reasoning / Emotion</label>
                  <textarea className="form-input form-textarea" rows="3" placeholder="Why did you enter? How did you feel?"
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <button className="submit-btn" type="button" disabled={saving} onClick={saveAnnotation}>
                {saving ? 'Saving...' : 'Save Annotation'}
              </button>
              {annMsg && <div className={`form-msg ${annMsg.type}`}>{annMsg.text}</div>}
            </>
          )}
        </div>
        {!isApi && (
          <button className="modal-delete-btn" type="button" onClick={handleDelete}>Delete this trade</button>
        )}
      </div>
    </div>
  );
}