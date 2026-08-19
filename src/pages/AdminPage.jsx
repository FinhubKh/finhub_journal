import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import {
  adminPlatformStats,
  adminListUsers,
  adminSetUserRole,
  adminDeleteUser,
  adminFetchTradingAccounts,
  adminDeleteTradingAccount,
  adminFetchSyncKeys,
  adminRevokeSyncKey,
  adminFetchTeams,
  adminDeleteTeam,
} from '../api/admin';
import {
  btnDanger, btnOutline, btnSm, card, cardBody, cardHd, cardTitle,
  dashboardPageWide, emptyState, input, msgError, tableTd, tableTh,
  pillToggle, pillBtn, pageShell,
} from '../lib/ui';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'sync', label: 'Sync keys' },
  { id: 'teams', label: 'Teams' },
];

function StatCard({ label, value }) {
  return (
    <div className={`${card} flex h-full flex-col justify-between p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

function AdminTabBar({ activeTab, onChange }) {
  return (
    <nav className="shrink-0 -mx-1 overflow-x-auto px-1 pb-1" aria-label="Admin sections">
      <div className={`${pillToggle} w-max min-w-full sm:min-w-0`} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${pillBtn(activeTab === tab.id)} whitespace-nowrap px-3.5 py-1.5`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
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
  const [accounts, setAccounts] = useState([]);
  const [syncKeys, setSyncKeys] = useState([]);
  const [teams, setTeams] = useState([]);
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
      const [statsData, usersData, accountsData, keysData, teamsData] = await Promise.all([
        adminPlatformStats(),
        adminListUsers(),
        adminFetchTradingAccounts(),
        adminFetchSyncKeys(),
        adminFetchTeams().catch(() => []),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
      setAccounts(accountsData || []);
      setSyncKeys(keysData || []);
      setTeams(teamsData || []);
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

  async function handleDeleteTeam(team) {
    const ok = await confirm({
      title: `Delete team "${team.name}"?`,
      message: 'Permanently removes the team. Members will be detached.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(team.id);
    try {
      await adminDeleteTeam(team.id);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not delete team.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={pageShell}>
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className={`${dashboardPageWide} flex flex-wrap items-center justify-between gap-3 py-4`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Admin</div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Platform control</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={btnOutline} type="button" onClick={() => navigate('/dashboard')}>
              Open journal
            </button>
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
                <StatCard label="Trading accounts" value={stats.total_accounts} />
                <StatCard label="Active sync keys" value={stats.active_sync_keys} />
                <StatCard label="Teams" value={teams.length} />
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
                        <th className={tableTh}>Accounts</th>
                        <th className={tableTh}>Keys</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
                          <td className={tableTd}>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{user.display_name || '—'}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</div>
                          </td>
                          <td className={tableTd}>
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              user.role === 'admin' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className={tableTd}>{user.account_count}</td>
                          <td className={tableTd}>{user.sync_key_count}</td>
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
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {accounts.map((account) => (
                        <tr key={account.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
                          <td className={tableTd}>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{account.name}</div>
                            {account.broker && <div className="text-xs text-zinc-500 dark:text-zinc-400">{account.broker}</div>}
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
                        <th className={tableTh}>Last synced</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {syncKeys.map((key) => (
                        <tr key={key.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
                          <td className={tableTd}>{userById[key.user_id]?.email || key.user_id?.slice(0, 8)}</td>
                          <td className={tableTd}>{accountById[key.trading_account_id]?.name || key.trading_account_id?.slice(0, 8)}</td>
                          <td className={tableTd}>{key.created_at ? new Date(key.created_at).toLocaleString() : '—'}</td>
                          <td className={tableTd}>{key.last_synced_at ? new Date(key.last_synced_at).toLocaleString() : '—'}</td>
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

            {activeTab === 'teams' && (
              <section className={card}>
                <div className={cardHd}>
                  <h2 className={cardTitle}>Teams ({teams.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className={tableTh}>Team</th>
                        <th className={tableTh}>Creator</th>
                        <th className={tableTh}>Created</th>
                        <th className={`${tableTh} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {teams.map((team) => (
                        <tr key={team.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50">
                          <td className={tableTd}>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{team.name}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">[{team.tag}]</div>
                          </td>
                          <td className={tableTd}>{userById[team.created_by]?.email || team.created_by?.slice(0, 8)}</td>
                          <td className={tableTd}>{team.created_at ? new Date(team.created_at).toLocaleString() : '—'}</td>
                          <td className={`${tableTd} text-right`}>
                            <button
                              className={btnDanger}
                              type="button"
                              disabled={busyId === team.id}
                              onClick={() => handleDeleteTeam(team)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {teams.length === 0 && <p className={emptyState}>No teams exist yet.</p>}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
