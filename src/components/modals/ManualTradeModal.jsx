import { useEffect, useState } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { useDialog } from '../../context/DialogContext';
import { insertTrade } from '../../api';
import { uploadTradeImage, validateTradeImageFile, MAX_IMAGES } from '../../api/tradeImages';
import { fromDisplayPnl, moneySymbol } from '../../lib/format';
import { normalizePnlDenomination } from '../../lib/accounts';
import CustomDropdown from '../common/CustomDropdown';
import {
  btnGhost, btnPrimary, card, input, label, msgError,
} from '../../lib/ui';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ManualTradeModal({ isOpen, onClose }) {
  const { userModels, tradingAccounts, activeAccount, refreshTrades } = useAppData();
  const { alert } = useDialog();

  const [date, setDate] = useState(todayIso());
  const [result, setResult] = useState('win');
  const [rValue, setRValue] = useState('');
  const [pnl, setPnl] = useState('');
  const [session, setSession] = useState('');
  const [model, setModel] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setDate(todayIso());
    setResult('win');
    setRValue('');
    setPnl('');
    setSession('');
    setModel('');
    setNotes('');
    setAccountId(activeAccount?.id || tradingAccounts[0]?.id || '');
    setPendingFiles([]);
    setError(null);
    setSaving(false);
  }, [isOpen, activeAccount, tradingAccounts]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const selectedAccount = tradingAccounts.find((a) => a.id === accountId) || activeAccount;
  const denomination = normalizePnlDenomination(selectedAccount?.pnl_denomination);
  const pnlLabel = moneySymbol(denomination) === '¢' ? 'PnL (¢)' : 'PnL (USD)';
  const pnlPlaceholder = denomination === 'cent' ? 'e.g. 1250' : '0.00';

  function addFiles(fileList) {
    const next = [...pendingFiles];
    for (const file of Array.from(fileList || [])) {
      try {
        validateTradeImageFile(file);
      } catch (err) {
        setError(err.message);
        continue;
      }
      if (next.length >= MAX_IMAGES) break;
      next.push({
        id: crypto.randomUUID(),
        file,
        label: 'Entry',
        preview: URL.createObjectURL(file),
      });
    }
    setPendingFiles(next.slice(0, MAX_IMAGES));
  }

  function removePending(id) {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);

    const account = tradingAccounts.find((a) => a.id === accountId) || activeAccount;
    if (!account) {
      setError('Create a trading account in Settings first.');
      return;
    }

    const denomination = normalizePnlDenomination(account.pnl_denomination);

    setSaving(true);
    try {
      const rows = await insertTrade({
        date,
        result,
        r_value: rValue !== '' ? Number(rValue) : 0,
        pnl_usd: pnl !== '' ? fromDisplayPnl(pnl, denomination) : 0,
        notes: notes.trim() || null,
        model: model || null,
        session: session || null,
        source: 'manual',
        account: account.name,
        account_id: account.id,
      });
      const trade = Array.isArray(rows) ? rows[0] : rows;
      if (!trade?.id) throw new Error('Trade was not created');

      for (const item of pendingFiles) {
        await uploadTradeImage(trade.id, item.file, item.label);
      }

      pendingFiles.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      await refreshTrades();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save manual trade.');
      await alert({ title: 'Error', message: err.message || 'Could not save manual trade.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        className={`${card} max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-trade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 id="manual-trade-title" className="text-base font-semibold text-zinc-900">Log manual trade</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Screenshots only work on manual trades (not MT5 sync).</p>
          </div>
          <button className={btnGhost} type="button" disabled={saving} onClick={onClose}>Close</button>
        </div>

        <form className="space-y-4 px-5 py-4" onSubmit={handleSave}>
          {error && <p className={msgError}>{error}</p>}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="manual-date">Date</label>
              <input id="manual-date" className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className={label}>Result</label>
              <CustomDropdown
                className="w-full"
                menuClassName="w-full"
                value={result}
                onChange={setResult}
                options={[
                  { value: 'win', label: 'Win' },
                  { value: 'loss', label: 'Loss' },
                  { value: 'be', label: 'BE' },
                ]}
              />
            </div>
            <div>
              <label className={label} htmlFor="manual-r">R Value</label>
              <input id="manual-r" className={input} type="number" step="0.1" value={rValue} onChange={(e) => setRValue(e.target.value)} placeholder="0.0" />
            </div>
            <div>
              <label className={label} htmlFor="manual-pnl">{pnlLabel}</label>
              <input id="manual-pnl" className={input} type="number" step="0.01" value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder={pnlPlaceholder} />
            </div>
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
              <label className={label}>Model</label>
              <CustomDropdown
                className="w-full"
                menuClassName="w-full"
                value={model}
                onChange={setModel}
                options={[
                  { value: '', label: 'Select...' },
                  ...userModels.map((m) => ({ value: m.name, label: m.name })),
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Account</label>
              <CustomDropdown
                className="w-full"
                menuClassName="w-full"
                value={accountId}
                onChange={setAccountId}
                options={tradingAccounts.map((a) => ({ value: a.id, label: a.name }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="manual-notes">Notes / setup reasoning</label>
              <textarea
                id="manual-notes"
                className={`${input} resize-none`}
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why this entry? What did you see?"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Screenshots ({pendingFiles.length}/{MAX_IMAGES})
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              disabled={saving || pendingFiles.length >= MAX_IMAGES}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {pendingFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pendingFiles.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                    <img src={item.preview} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="space-y-1 p-1.5">
                      <CustomDropdown
                        className="w-full"
                        menuClassName="w-28"
                        value={item.label}
                        onChange={(v) => {
                          setPendingFiles((prev) => prev.map((p) => (p.id === item.id ? { ...p, label: v } : p)));
                        }}
                        options={[
                          { value: 'Entry', label: 'Entry' },
                          { value: 'HTF', label: 'HTF' },
                          { value: 'Exit', label: 'Exit' },
                          { value: 'Other', label: 'Other' },
                        ]}
                      />
                      <button
                        type="button"
                        className="w-full rounded-md text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                        onClick={() => removePending(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button className={btnGhost} type="button" disabled={saving} onClick={onClose}>Cancel</button>
            <button className={btnPrimary} type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
