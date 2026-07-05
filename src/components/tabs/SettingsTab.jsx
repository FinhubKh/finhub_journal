import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { getUserDisplayName, getUserEmail } from '../../lib/auth';
import {
  insertStep, deleteStep, insertModel, deleteModel,
  generateSyncKey, hasSyncKey, revokeSyncKey, getSyncKey,
} from '../../lib/api';

export default function SettingsTab() {
  const { signOut, setDisplayName } = useAuth();
  const { userSteps, userModels, refreshSteps, refreshModels, allTrades, dark, toggleDark } = useAppData();

  const email = getUserEmail();

  const [dnInput, setDnInput] = useState(getUserDisplayName());
  const [dnMsg, setDnMsg] = useState(null);
  const [dnSaving, setDnSaving] = useState(false);

  const [lbOptIn, setLbOptIn] = useState(() => localStorage.getItem('nxuu_lb_optin') === 'true');

  const [newStepSection, setNewStepSection] = useState('');
  const [newStepTitle, setNewStepTitle] = useState('');

  const [newModelName, setNewModelName] = useState('');

  const [startingBalance, setStartingBalance] = useState(() => localStorage.getItem('nxuu_starting_balance') || '');
  const [sbMsg, setSbMsg] = useState(null);

  const [syncStatus, setSyncStatus] = useState('—');
  const [syncReveal, setSyncReveal] = useState(null);

  useEffect(() => { refreshSyncStatus(); loadSyncKey(); }, []);

  async function loadSyncKey() {
    try { const k = await getSyncKey(); if (k) setSyncReveal(k); } catch (e) { /* ignore */ }
  }

  async function refreshSyncStatus() {
    try { setSyncStatus((await hasSyncKey()) ? 'Sync key active' : 'No sync key yet'); }
    catch (e) { setSyncStatus('—'); }
  }

  async function saveDisplayName() {
    const name = dnInput.trim();
    if (!name) return;
    setDnSaving(true);
    try {
      await setDisplayName(name);
      setDnMsg({ text: 'Saved!', type: 'success' });
      setTimeout(() => setDnMsg(null), 3000);
    } catch (e) {
      setDnMsg({ text: e.message, type: 'error' });
    } finally {
      setDnSaving(false);
    }
  }

  function saveLbOptIn(checked) {
    setLbOptIn(checked);
    localStorage.setItem('nxuu_lb_optin', checked);
  }

  async function addStep() {
    const section = newStepSection.trim(), title = newStepTitle.trim();
    if (!section || !title) return alert('Please fill in both section and title.');
    try {
      await insertStep(section, title, userSteps.length);
      setNewStepSection(''); setNewStepTitle('');
      await refreshSteps();
    } catch (e) { alert('Could not add step.'); }
  }

  async function removeStep(id) {
    if (!confirm('Delete this step?')) return;
    try { await deleteStep(id); await refreshSteps(); }
    catch (e) { alert('Could not delete step.'); }
  }

  async function addModel() {
    const name = newModelName.trim();
    if (!name) return alert('Please enter a model name.');
    try { await insertModel(name); setNewModelName(''); await refreshModels(); }
    catch (e) { alert('Could not add model.'); }
  }

  async function removeModel(id) {
    if (!confirm('Delete this model?')) return;
    try { await deleteModel(id); await refreshModels(); }
    catch (e) { alert('Could not delete model.'); }
  }

  function saveStartingBalance() {
    const val = parseFloat(startingBalance);
    if (!startingBalance || isNaN(val) || val <= 0) {
      setSbMsg({ text: 'Please enter a valid positive number.', type: 'error' });
      setTimeout(() => setSbMsg(null), 3000);
      return;
    }
    localStorage.setItem('nxuu_starting_balance', val.toString());
    setSbMsg({ text: 'Saved!', type: 'success' });
    setTimeout(() => setSbMsg(null), 3000);
  }

  async function handleGenerateSyncKey() {
    if (!confirm('Generate a new sync key? Any previous key (and your EA config) will stop working.')) return;
    try {
      const key = await generateSyncKey();
      setSyncReveal(key);
      await refreshSyncStatus();
    } catch (e) { alert('Could not generate sync key.'); }
  }

  async function handleRevokeSyncKey() {
    if (!confirm('Revoke sync key? The EA will stop syncing until you generate a new one.')) return;
    try { await revokeSyncKey(); setSyncReveal(null); await refreshSyncStatus(); }
    catch (e) { alert('Could not revoke key.'); }
  }

  function exportCSV() {
    if (allTrades.length === 0) return alert('No trades to export.');
    const headers = ['Date', 'Result', 'R Value', 'PnL (USD)', 'Account', 'Model', 'Session', 'Notes'];
    const rows = allTrades.map((t) => [t.date, t.result, t.r_value || '', t.pnl_usd || '', t.account || '', t.model || '', t.session || '', (t.notes || '').replace(/,/g, ' ')]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `nxuu-trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="pane-inner">
      <div className="settings-section-label">Account</div>
      <div className="card">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Signed in as</div>
            <div className="settings-row-sub">{email}</div>
          </div>
          <button className="danger-btn" onClick={signOut}>Sign Out</button>
        </div>
        <div className="settings-add-form" style={{ borderTop: '1px solid var(--border)' }}>
          <label className="form-label">Display name <span className="form-hint">(shown on leaderboard)</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" type="text" placeholder="e.g. nXuu_Trader1" style={{ flex: 1 }}
              value={dnInput} onChange={(e) => setDnInput(e.target.value)} />
            <button className="add-btn" type="button" disabled={dnSaving} onClick={saveDisplayName}>{dnSaving ? 'Saving...' : 'Save'}</button>
          </div>
          {dnMsg && <div className={`auth-msg ${dnMsg.type}`}>{dnMsg.text}</div>}
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>Appearance</div>
      <div className="card">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Dark mode</div>
            <div className="settings-row-sub">Easier on the eyes during night sessions</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={dark} onChange={toggleDark} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>Team</div>
      <div className="card">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Share stats with team</div>
            <div className="settings-row-sub">Appear on the leaderboard</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={lbOptIn} onChange={(e) => saveLbOptIn(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>MT4/5 Sync (EA)</div>
      <div className="card">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Sync Key</div>
            <div className="settings-row-sub">{syncStatus}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="add-btn" type="button" onClick={handleGenerateSyncKey}>Generate</button>
            <button className="danger-btn" type="button" onClick={handleRevokeSyncKey}>Revoke</button>
          </div>
        </div>
        {syncReveal && (
          <div className="detail-notes-box" style={{ margin: '0 16px 16px' }}>
            <div className="detail-notes-label">Your sync key</div>
            <div className="detail-notes-text" style={{ fontFamily: 'var(--font-mono)', userSelect: 'all', wordBreak: 'break-all' }}>{syncReveal}</div>
            <div className="form-hint" style={{ marginTop: 6 }}>Paste this into the EA's "Sync Key" input in MT4/5.</div>
          </div>
        )}
        <div className="settings-row-sub" style={{ padding: '0 16px 16px' }}>
          Generate a key, paste it into the nXuu EA's "Sync Key" input in MT4/5. Every time you start MT4/5 with the EA attached, your full closed trade history is sent — new trades are added, existing ones are never overwritten.
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>Checklist Steps</div>
      <div className="card">
        {userSteps.length === 0 ? (
          <div className="empty-state">No steps yet.</div>
        ) : userSteps.map((s) => (
          <div className="manage-row" key={s.id}>
            <div className="manage-row-info">
              <span className="manage-row-section">{s.section}</span>
              <span className="manage-row-title">{s.title}</span>
            </div>
            <button className="delete-btn" type="button" onClick={() => removeStep(s.id)}>✕</button>
          </div>
        ))}
        <div className="settings-add-form">
          <input className="form-input" type="text" placeholder="Section (e.g. HTF Context)" value={newStepSection} onChange={(e) => setNewStepSection(e.target.value)} />
          <input className="form-input" type="text" placeholder="Step title" style={{ marginTop: 8 }} value={newStepTitle} onChange={(e) => setNewStepTitle(e.target.value)} />
          <button className="add-btn" type="button" onClick={addStep}>+ Add Step</button>
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>Entry Models</div>
      <div className="card">
        {userModels.length === 0 ? (
          <div className="empty-state">No models yet.</div>
        ) : userModels.map((m) => (
          <div className="manage-row" key={m.id}>
            <div className="manage-row-info"><span className="manage-row-title">{m.name}</span></div>
            <button className="delete-btn" type="button" onClick={() => removeModel(m.id)}>✕</button>
          </div>
        ))}
        <div className="settings-add-form">
          <input className="form-input" type="text" placeholder="Model name (e.g. Jab Kvort)" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} />
          <button className="add-btn" type="button" onClick={addModel}>+ Add Model</button>
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>Account Growth</div>
      <div className="card">
        <div className="settings-add-form">
          <label className="form-label">Starting Balance <span className="form-hint">(used for account growth % on Stats)</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" type="number" step="0.01" placeholder="e.g. 10000" style={{ flex: 1 }}
              value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
            <button className="add-btn" type="button" onClick={saveStartingBalance}>Save</button>
          </div>
          {sbMsg && <div className={`auth-msg ${sbMsg.type}`}>{sbMsg.text}</div>}
        </div>
      </div>

      <div className="settings-section-label" style={{ marginTop: 20 }}>Data</div>
      <div className="card">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Export trades</div>
            <div className="settings-row-sub">Download all your trades as CSV</div>
          </div>
          <button className="text-btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>
    </div>
  );
}