import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import {
  adminPlatformStats,
  adminListUsers,
  adminSetUserRole,
  adminDeleteUser,
  adminFetchTrades,
  adminDeleteTrade,
  adminFetchTradingAccounts,
  adminDeleteTradingAccount,
  adminFetchSyncKeys,
  adminRevokeSyncKey,
} from '../api/admin';
import {
  btnDanger, btnGhost, btnOutline, btnSm, card, cardBody, cardHd, cardTitle,
  dashboardPageWide, emptyState, input, msgError, tableTd, tableTdRight, tableTh,
} from '../lib/ui';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'trades', label: 'Trades' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'sync', label: 'Sync keys' },
];

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
    </div>
  );
}

function AdminTabBar({ activeTab, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            activeTab === tab.id
              ? 'bg-violet-100 text-violet-700'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { alert, confirm } = useDialog();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [syncKeys, setSyncKeys] = useState([]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const userById = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[u.id] = u; });
    return map;
  }, [users]);

  const accountById = useMemo(() => {
    const map = {};
    accounts.forEach((a) => { map[a.id] = a; });
    return map;
  }, [accounts]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, usersData, tradesData, accountsData, keysData] = await Promise.all([
        adminPlatformStats(),
        adminListUsers(),
        adminFetchTrades(250),
        adminFetchTradingAccounts(),
        adminFetchSyncKeys(),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
      setTrades(tradesData || []);
      setAccounts(accountsData || []);
      setSyncKeys(keysData || []);
    } catch (e) {
      setError(e.message || 'Could not load admin data. Run backend/schema_profiles_admin.sql in Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const q = search.trim().toLowerCase();

  const filteredUsers = users.filter((u) =>
    !q || u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q),
  );

  const filteredTrades = trades.filter((t) => {
    if (!q) return true;
    const u = userById[t.user_id];
    return (
      u?.email?.toLowerCase().includes(q)
      || t.symbol?.toLowerCase().includes(q)
      || t.account?.toLowerCase().includes(q)
      || String(t.ticket || '').includes(q)
    );
  });

  async function handleToggleRole(user) {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const ok = await confirm({
      title: nextRole === 'admin' ? 'Promote to admin?' : 'Remove admin role?',
      message: `${user.email} will be set to "${nextRole}".`,
      confirmLabel: 'Confirm',
      destructive: nextRole === 'user',
    });
    if (!ok) return;
    setBusyId(user.id);
    try {
      await adminSetUserRole(user.id, nextRole);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not update role.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteUser(user) {
    const ok = await confirm({
      title: `Delete user ${user.email}?`,
      message: 'Permanently deletes the auth account and all journal data.',
      confirmLabel: 'Delete user',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(user.id);
    try {
      await adminDeleteUser(user.id);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not delete user.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteTrade(trade) {
    const ok = await confirm({
      title: 'Delete trade?',
      message: `Ticket ${trade.ticket || trade.id} will be removed.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(trade.id);
    try {
      await adminDeleteTrade(trade.id);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not delete trade.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAccount(account) {
    const ok = await confirm({
      title: `Delete account "${account.name}"?`,
      message: 'Removes the trading account and all linked synced trades.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(account.id);
    try {
      await adminDeleteTradingAccount(account.id);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not delete account.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeKey(key) {
    const ok = await confirm({
      title: 'Revoke sync key?',
      message: 'MT5 will stop syncing for this account until a new key is generated.',
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(key.id);
    try {
      await adminRevokeSyncKey(key.id);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not revoke key.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className={`${dashboardPageWide} flex flex-wrap items-center justify-between gap-3 py-4`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-violet-600">Admin</div>
            <h1 className="text-lg font-bold text-zinc-900">Platform control</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className={btnOutline} to="/dashboard">Back to journal</Link>
            <button className={btnGhost} type="button" onClick={loadAll} disabled={loading}>Refresh</button>
            <button className={btnDanger} type="button" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</button>
          </div>
        </div>
      </header>

      <main className={`${dashboardPageWide} space-y-5 py-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <AdminTabBar activeTab={activeTab} onChange={setActiveTab} />
          {activeTab !== 'overview' && (
            <input
              className={`${input} max-w-xs`}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </div>

        {error && <p className={msgError}>{error}</p>}

        {loading ? (
          <div className={emptyState}>Loading admin data...</div>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Users" value={stats.total_users} />
                <StatCard label="Trades" value={stats.total_trades} />
                <StatCard label="EA synced" value={stats.api_trades} />
                <StatCard label="Trading accounts" value={stats.total_accounts} />
                <StatCard label="Active sync keys" value={stats.active_sync_keys} />
                <StatCard label="Admins" value={stats.admin_users} />
                <StatCard label="Total PnL (USD)" value={`$${Number(stats.total_pnl || 0).toLocaleString()}`} />
              </div>
            )}

            {activeTab === 'users' && (
              <section className={card}>
                <div className={cardHd}>
                  <h2 className={cardTitle}>Users ({filteredUsers.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className={tableTh}>User</th>
                        <th className={tableTh}>Role</th>
                        <th className={tableTh}>Trades</th>
                        <th className={tableTh}>Accounts</th>
                        <th className={tableTh}>Keys</th>
                        <th className={`${tableTh} text-right`}>PnL</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-zinc-50/80">
                          <td className={tableTd}>
                            <div className="font-semibold text-zinc-900">{user.display_name || '—'}</div>
                            <div className="text-xs text-zinc-500">{user.email}</div>
                          </td>
                          <td className={tableTd}>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              user.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-zinc-100 text-zinc-600'
                            }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className={tableTd}>{user.trade_count}</td>
                          <td className={tableTd}>{user.account_count}</td>
                          <td className={tableTd}>{user.sync_key_count}</td>
                          <td className={tableTdRight}>
                            ${Number(user.total_pnl || 0).toLocaleString()}
                          </td>
                          <td className={`${tableTd} text-right`}>
                            <div className="flex justify-end gap-1">
                              <button
                                className={btnSm}
                                type="button"
                                disabled={busyId === user.id}
                                onClick={() => handleToggleRole(user)}
                              >
                                {user.role === 'admin' ? 'Demote' : 'Make admin'}
                              </button>
                              <button
                                className={btnDanger}
                                type="button"
                                disabled={busyId === user.id}
                                onClick={() => handleDeleteUser(user)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'trades' && (
              <section className={card}>
                <div className={cardHd}>
                  <h2 className={cardTitle}>Recent trades ({filteredTrades.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className={tableTh}>Date</th>
                        <th className={tableTh}>User</th>
                        <th className={tableTh}>Symbol</th>
                        <th className={tableTh}>Account</th>
                        <th className={tableTh}>Source</th>
                        <th className={tableTh}>Result</th>
                        <th className={`${tableTh} text-right`}>PnL</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredTrades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-zinc-50/80">
                          <td className={tableTd}>{trade.date}</td>
                          <td className={tableTd}>
                            <div className="text-xs text-zinc-600">{userById[trade.user_id]?.email || trade.user_id?.slice(0, 8)}</div>
                          </td>
                          <td className={tableTd}>{trade.symbol || '—'}</td>
                          <td className={tableTd}>{trade.account || accountById[trade.account_id]?.name || '—'}</td>
                          <td className={tableTd}>{trade.source || 'manual'}</td>
                          <td className={tableTd}>{trade.result}</td>
                          <td className={tableTdRight}>${Number(trade.pnl_usd || 0).toLocaleString()}</td>
                          <td className={`${tableTd} text-right`}>
                            <button
                              className={btnDanger}
                              type="button"
                              disabled={busyId === trade.id}
                              onClick={() => handleDeleteTrade(trade)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'accounts' && (
              <section className={card}>
                <div className={cardHd}>
                  <h2 className={cardTitle}>Trading accounts ({accounts.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className={tableTh}>Account</th>
                        <th className={tableTh}>User</th>
                        <th className={tableTh}>Type</th>
                        <th className={tableTh}>PnL mode</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {accounts.map((account) => (
                        <tr key={account.id} className="hover:bg-zinc-50/80">
                          <td className={tableTd}>
                            <div className="font-semibold text-zinc-900">{account.name}</div>
                            {account.broker && <div className="text-xs text-zinc-500">{account.broker}</div>}
                          </td>
                          <td className={tableTd}>{userById[account.user_id]?.email || account.user_id?.slice(0, 8)}</td>
                          <td className={tableTd}>{account.account_type}</td>
                          <td className={tableTd}>{account.pnl_denomination}</td>
                          <td className={`${tableTd} text-right`}>
                            <button
                              className={btnDanger}
                              type="button"
                              disabled={busyId === account.id}
                              onClick={() => handleDeleteAccount(account)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'sync' && (
              <section className={card}>
                <div className={cardHd}>
                  <h2 className={cardTitle}>EA sync keys ({syncKeys.length})</h2>
                </div>
                <div className={`${cardBody} overflow-x-auto`}>
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className={tableTh}>User</th>
                        <th className={tableTh}>Trading account</th>
                        <th className={tableTh}>Created</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {syncKeys.map((key) => (
                        <tr key={key.id} className="hover:bg-zinc-50/80">
                          <td className={tableTd}>{userById[key.user_id]?.email || key.user_id?.slice(0, 8)}</td>
                          <td className={tableTd}>{accountById[key.trading_account_id]?.name || key.trading_account_id?.slice(0, 8)}</td>
                          <td className={tableTd}>{key.created_at ? new Date(key.created_at).toLocaleString() : '—'}</td>
                          <td className={`${tableTd} text-right`}>
                            <button
                              className={btnDanger}
                              type="button"
                              disabled={busyId === key.id}
                              onClick={() => handleRevokeKey(key)}
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {syncKeys.length === 0 && <p className={emptyState}>No active sync keys.</p>}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
