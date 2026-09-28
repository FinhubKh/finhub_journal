import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuArrowLeft, LuX } from 'react-icons/lu';
import { adminGetAccountDetail, adminGetUserDetail } from '../../api/admin';
import {
  btnDanger, btnGhost, btnOutline, btnSm, card, emptyState, msgError, tableTd, tableTh,
} from '../../lib/ui';

function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function fmtPct(wins, total) {
  const t = Number(total) || 0;
  if (!t) return '—';
  return `${(((Number(wins) || 0) / t) * 100).toFixed(1)}%`;
}

function DetailShell({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-zinc-950/40 backdrop-blur-[1px]"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={onClose}
            aria-label="Close"
          >
            <LuX className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}

function StatGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={`${card} p-3.5`}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{item.label}</div>
          <div className="mt-1 text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminUserDetailDrawer({
  userId,
  onClose,
  onOpenAccount,
  onToggleRole,
  onDeleteUser,
  busyId,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await adminGetUserDetail(userId);
        if (!cancelled) setData(detail);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load user detail.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const profile = data?.profile;
  const summary = data?.summary || {};
  const accounts = data?.accounts || [];
  const syncKeys = data?.sync_keys || [];
  const teams = data?.teams || [];

  return (
    <DetailShell
      title={profile?.display_name || profile?.email || 'User detail'}
      subtitle={profile?.email}
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button className={btnGhost} type="button" onClick={onClose}>Close</button>
          {profile ? (
            <>
              <button
                className={btnSm}
                type="button"
                disabled={busyId === profile.id}
                onClick={() => onToggleRole?.(profile)}
              >
                {profile.role === 'admin' ? 'Demote' : 'Make admin'}
              </button>
              <button
                className={btnDanger}
                type="button"
                disabled={busyId === profile.id}
                onClick={() => onDeleteUser?.(profile)}
              >
                Delete user
              </button>
            </>
          ) : null}
        </div>
      )}
    >
      {loading ? <div className={emptyState}>Loading user…</div> : null}
      {error ? <p className={msgError}>{error}</p> : null}

      {!loading && profile ? (
        <div className="space-y-6">
          <StatGrid
            items={[
              { label: 'Role', value: profile.role || '—' },
              { label: 'Joined', value: fmtDate(profile.created_at) },
              { label: 'Accounts', value: summary.account_count ?? accounts.length },
              { label: 'Sync keys', value: summary.sync_key_count ?? syncKeys.length },
              { label: 'Trades', value: summary.trade_count ?? 0 },
              { label: 'Total PnL', value: fmtMoney(summary.total_pnl) },
            ]}
          />

          <Section title={`Accounts (${accounts.length})`}>
            {accounts.length === 0 ? (
              <p className="text-sm text-zinc-500">No trading accounts.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className={tableTh}>Account</th>
                      <th className={tableTh}>SIAC</th>
                      <th className={tableTh}>Trades</th>
                      <th className={tableTh}>PnL</th>
                      <th className={`${tableTh} text-right`}> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td className={tableTd}>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{account.name}</div>
                          <div className="text-xs text-zinc-500">
                            {[account.account_type, account.broker].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </td>
                        <td className={tableTd}>
                          {account.risk_track
                            ? `${account.risk_track}${account.risk_eligible ? ' · eligible' : ' · open'}`
                            : 'Not set'}
                        </td>
                        <td className={tableTd}>{account.trade_count ?? 0}</td>
                        <td className={tableTd}>{fmtMoney(account.total_pnl)}</td>
                        <td className={`${tableTd} text-right`}>
                          <button
                            type="button"
                            className={btnOutline}
                            onClick={() => onOpenAccount?.(account.id)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={`Sync keys (${syncKeys.length})`}>
            {syncKeys.length === 0 ? (
              <p className="text-sm text-zinc-500">No active sync keys.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {syncKeys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{key.account_name || 'Account'}</div>
                      <div className="text-xs text-zinc-500">Created {fmtDate(key.created_at)}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      Last sync<br />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmtDate(key.last_synced_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Teams (${teams.length})`}>
            {teams.length === 0 ? (
              <p className="text-sm text-zinc-500">Not on any team.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {teams.map((team) => (
                  <li key={team.id} className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{team.name}</div>
                      <div className="text-xs text-zinc-500">[{team.tag}] · {team.role || 'member'}</div>
                    </div>
                    <div className="text-xs text-zinc-500">{fmtDate(team.joined_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}
    </DetailShell>
  );
}

export function AdminAccountDetailDrawer({
  accountId,
  onClose,
  onBackToUser,
  onDeleteAccount,
  busyId,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!accountId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await adminGetAccountDetail(accountId);
        if (!cancelled) setData(detail);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load account detail.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  const account = data?.account;
  const owner = data?.owner;
  const stats = data?.stats || {};
  const syncKey = data?.sync_key;
  const trades = data?.trades || data?.recent_trades || [];

  return (
    <DetailShell
      title={account?.name || 'Account detail'}
      subtitle={owner?.email ? `Owner · ${owner.email}` : undefined}
      onClose={onClose}
      footer={(
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            {owner?.id && onBackToUser ? (
              <button className={btnGhost} type="button" onClick={() => onBackToUser(owner.id)}>
                <LuArrowLeft className="h-4 w-4" />
                Owner
              </button>
            ) : (
              <button className={btnGhost} type="button" onClick={onClose}>Close</button>
            )}
          </div>
          {account ? (
            <button
              className={btnDanger}
              type="button"
              disabled={busyId === account.id}
              onClick={() => onDeleteAccount?.(account)}
            >
              Delete account
            </button>
          ) : null}
        </div>
      )}
    >
      {loading ? <div className={emptyState}>Loading account…</div> : null}
      {error ? <p className={msgError}>{error}</p> : null}

      {!loading && account ? (
        <div className="space-y-6">
          <StatGrid
            items={[
              { label: 'Type', value: account.account_type || '—' },
              { label: 'Broker', value: account.broker || '—' },
              { label: 'PnL mode', value: account.pnl_denomination || '—' },
              { label: 'Starting balance', value: fmtMoney(account.starting_balance) },
              { label: 'Connection', value: account.connection_status || '—' },
              { label: 'Public', value: account.is_public ? 'Yes' : 'No' },
              { label: 'Default', value: account.is_default ? 'Yes' : 'No' },
              { label: 'Created', value: fmtDate(account.created_at) },
            ]}
          />

          <Section title="Performance">
            <StatGrid
              items={[
                { label: 'Trades', value: stats.trade_count ?? 0 },
                { label: 'Win rate', value: fmtPct(stats.wins, stats.trade_count) },
                { label: 'Wins / Losses', value: `${stats.wins ?? 0} / ${stats.losses ?? 0}` },
                { label: 'Total PnL', value: fmtMoney(stats.total_pnl) },
                { label: 'Gross win', value: fmtMoney(stats.gross_win) },
                { label: 'Gross loss', value: fmtMoney(stats.gross_loss) },
                { label: 'Max drawdown', value: fmtMoney(stats.max_dd) },
                { label: 'Stats updated', value: fmtDate(stats.updated_at) },
              ]}
            />
          </Section>

          <Section title="SIAC eligibility">
            <StatGrid
              items={[
                { label: 'Track', value: account.risk_track || 'Not set' },
                { label: 'Eligible', value: account.risk_track ? (account.risk_eligible ? 'Yes' : 'No') : '—' },
                {
                  label: 'Failed rules',
                  value: Array.isArray(account.risk_failed_rules) && account.risk_failed_rules.length
                    ? account.risk_failed_rules.join(', ')
                    : 'None',
                },
                { label: 'Checked', value: fmtDate(account.risk_checked_at) },
              ]}
            />
          </Section>

          <Section title="Sync">
            {syncKey ? (
              <StatGrid
                items={[
                  { label: 'Key created', value: fmtDate(syncKey.created_at) },
                  { label: 'Last synced', value: fmtDate(syncKey.last_synced_at) },
                ]}
              />
            ) : (
              <p className="text-sm text-zinc-500">No sync key on this account.</p>
            )}
          </Section>

          <Section title={`All trades (${trades.length})`}>
            {trades.length === 0 ? (
              <p className="text-sm text-zinc-500">No trades yet.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className={tableTh}>Date</th>
                      <th className={tableTh}>Symbol</th>
                      <th className={tableTh}>Side</th>
                      <th className={tableTh}>Result</th>
                      <th className={tableTh}>PnL</th>
                      <th className={tableTh}>R</th>
                      <th className={tableTh}>Ticket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {trades.map((trade) => (
                      <tr key={trade.id}>
                        <td className={tableTd}>{trade.date || fmtDate(trade.close_time)}</td>
                        <td className={tableTd}>{trade.symbol || '—'}</td>
                        <td className={tableTd}>{trade.direction || '—'}</td>
                        <td className={tableTd}>{trade.result || '—'}</td>
                        <td className={tableTd}>{fmtMoney(trade.pnl_usd)}</td>
                        <td className={tableTd}>{trade.r_value ?? '—'}</td>
                        <td className={tableTd}>{trade.ticket ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </DetailShell>
  );
}
