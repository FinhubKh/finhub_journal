import { useEffect, useState } from 'react';
import { adminUpdateAppLimits } from '../../api/admin';
import {
  btnPrimary, card, cardHd, cardTitle, input, label, msgError, msgSuccess,
} from '../../lib/ui';

const MAX_LIMIT = 1000;

function parseLimit(value, name) {
  const n = Number(value);
  if (value === '' || !Number.isInteger(n) || n < 0 || n > MAX_LIMIT) {
    throw new Error(`${name} must be a whole number between 0 and ${MAX_LIMIT}.`);
  }
  return n;
}

export default function AccountLimitsAdminPanel({ limits, overrideCount, onSaved }) {
  const [form, setForm] = useState({ maxTradingAccounts: '', maxBacktests: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!limits) return;
    setForm({
      maxTradingAccounts: String(limits.maxTradingAccounts),
      maxBacktests: String(limits.maxBacktests),
    });
  }, [limits]);

  async function handleSave(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const next = await adminUpdateAppLimits({
        maxTradingAccounts: parseLimit(form.maxTradingAccounts, 'Trading accounts'),
        maxBacktests: parseLimit(form.maxBacktests, 'Backtesting strategies'),
      });
      onSaved?.(next);
      setMsg({ type: 'success', text: 'Default limits saved. They apply to new creations immediately.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Could not save limits.' });
    } finally {
      setBusy(false);
    }
  }

  if (!limits) {
    return (
      <p className={msgError}>
        Limits are not configured yet. Run backend/migrations/2026-10-23_admin_user_limits.sql in Supabase.
      </p>
    );
  }

  return (
    <section className={`${card} max-w-2xl`}>
      <div className={cardHd}>
        <h2 className={cardTitle}>Default limits per user</h2>
      </div>
      <form className="space-y-5 p-5" onSubmit={handleSave}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Applies to every user without a custom limit. To give one user a different limit, open them from the Users tab.
          {overrideCount > 0 ? ` ${overrideCount} user${overrideCount === 1 ? ' has' : 's have'} a custom limit.` : ''}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="limit-accounts">Trading accounts</label>
            <input
              id="limit-accounts"
              className={input}
              type="number"
              min={0}
              max={MAX_LIMIT}
              step={1}
              value={form.maxTradingAccounts}
              onChange={(e) => setForm((f) => ({ ...f, maxTradingAccounts: e.target.value }))}
            />
          </div>
          <div>
            <label className={label} htmlFor="limit-backtests">Backtesting strategies</label>
            <input
              id="limit-backtests"
              className={input}
              type="number"
              min={0}
              max={MAX_LIMIT}
              step={1}
              value={form.maxBacktests}
              onChange={(e) => setForm((f) => ({ ...f, maxBacktests: e.target.value }))}
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Lowering a limit never deletes anything — users above it keep what they have but can't create more.
        </p>
        {msg ? <p className={msg.type === 'error' ? msgError : msgSuccess}>{msg.text}</p> : null}
        <div className="flex justify-end">
          <button className={btnPrimary} type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save defaults'}
          </button>
        </div>
      </form>
    </section>
  );
}
