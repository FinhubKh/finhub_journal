import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchAllTrades } from '../api';
import { useDialog } from '../context/DialogContext';
import { getUserDisplayName, getUserEmail } from '../api/auth';
import { escapeCsvField } from '../lib/format';
import {
  btnDanger, btnGhost, btnPrimary, card, cardBody,
  input, label, msgError, msgSuccess, sectionLabel,
} from '../lib/ui';

function SettingsSection({ title, children, id }) {
  return (
    <section className="space-y-2" id={id}>
      {title && <h2 className={sectionLabel}>{title}</h2>}
      <div className={card}>{children}</div>
    </section>
  );
}

function SettingsRow({ title, sub, children }) {
  return (
    <div className={`${cardBody} flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800`}>
      <div>
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
        {sub && <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { alert } = useDialog();
  const { signOut, setDisplayName } = useAuth();

  const email = getUserEmail();

  const [dnInput, setDnInput] = useState(getUserDisplayName());
  const [dnMsg, setDnMsg] = useState(null);
  const [dnSaving, setDnSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  async function exportCSV() {
    setExporting(true);
    try {
      const trades = await fetchAllTrades();
      if (trades.length === 0) {
        await alert({ title: 'Nothing to export', message: 'No trades to export yet.' });
        return;
      }
      const headers = ['Date', 'Result', 'R Value', 'PnL (USD)', 'Account', 'Session', 'Notes'];
      const rows = trades.map((t) => [
        t.date,
        t.result,
        t.r_value || '',
        t.pnl_usd || '',
        t.account || '',
        t.session || '',
        t.notes || '',
      ]);
      const csv = [headers, ...rows]
        .map((r) => r.map(escapeCsvField).join(','))
        .join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      a.download = `nxuu-trades-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (e) {
      await alert({ title: 'Export failed', message: e?.message || 'Could not export trades.' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col px-4 pb-6 pt-4 md:px-6 md:pt-6">
      <div className="mb-5 shrink-0">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Profile and data export.</p>
      </div>

      <div className="flex flex-1 flex-col space-y-5">
        <SettingsSection title="Profile">
          <SettingsRow title="Signed in as" sub={email}>
            <button className={btnDanger} type="button" onClick={async () => { await signOut(); navigate('/'); }}>Sign Out</button>
          </SettingsRow>
          <div className={`${cardBody} space-y-3`}>
            <label className={label}>Display name</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${input} min-w-[200px] flex-1`}
                type="text"
                placeholder="e.g. FinhubKH_Trader1"
                value={dnInput}
                onChange={(e) => setDnInput(e.target.value)}
              />
              <button className={btnPrimary} type="button" disabled={dnSaving} onClick={saveDisplayName}>
                {dnSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {dnMsg && <p className={dnMsg.type === 'error' ? msgError : msgSuccess}>{dnMsg.text}</p>}
          </div>
        </SettingsSection>

        <SettingsSection title="Export">
          <SettingsRow title="Export trades" sub="Download all your trades as CSV">
            <button className={btnGhost} type="button" disabled={exporting} onClick={exportCSV}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  );
}
