import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LuChartPie,
  LuKeyRound,
  LuLogOut,
  LuMenu,
  LuRefreshCw,
  LuShield,
  LuUsers,
  LuWallet,
  LuX,
  LuUsersRound,
} from 'react-icons/lu';
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
import SiacRulesAdminPanel from '../components/admin/SiacRulesAdminPanel';
import { AdminAccountDetailDrawer, AdminUserDetailDrawer } from '../components/admin/AdminDetailDrawers';
import {
  appShell, btnDanger, btnOutline, btnSm, card, cardHd, cardTitle,
  emptyState, input, msgError, tableTd, tableTh,
} from '../lib/ui';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LuChartPie, group: 'General' },
  { id: 'users', label: 'Users', icon: LuUsers, group: 'People' },
  { id: 'teams', label: 'Teams', icon: LuUsersRound, group: 'People' },
  { id: 'accounts', label: 'Accounts', icon: LuWallet, group: 'Trading' },
  { id: 'sync', label: 'Sync keys', icon: LuKeyRound, group: 'Trading' },
  { id: 'siac', label: 'SIAC rules', icon: LuShield, group: 'Eligibility' },
];

const PAGE_META = {
  overview: { title: 'Overview', subtitle: 'Platform health at a glance' },
  users: { title: 'Users', subtitle: 'Roles and account access' },
  teams: { title: 'Teams', subtitle: 'Leaderboard teams across the platform' },
  accounts: { title: 'Trading accounts', subtitle: 'All linked broker / EA accounts' },
  sync: { title: 'Sync keys', subtitle: 'Active MT5 / EA sync credentials' },
  siac: { title: 'SIAC rules', subtitle: 'Eligibility thresholds and labels' },
};

function StatCard({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${card} flex min-h-36 flex-col justify-between p-6 text-left transition hover:border-zinc-300 dark:hover:border-zinc-700 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-4xl">
        {value ?? '—'}
      </div>
    </button>
  );
}

function AdminSidebar({ active, onChange, onSignOut, onClose, counts }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of NAV) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group).push(item);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            FinhubKH
          </div>
          <div className="mt-0.5 truncate text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Admin
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <LuX className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Admin sections">
        {groups.map(([group, items]) => (
          <div key={group}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {group}
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const selected = active === item.id;
                const count = counts?.[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      onClose?.();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      selected
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${selected ? 'opacity-90' : 'opacity-70'}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count != null ? (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          selected
                            ? 'bg-white/15 text-white dark:bg-zinc-900/10 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          onClick={onSignOut}
        >
          <LuLogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { alert, confirm } = useDialog();

  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [syncKeys, setSyncKeys] = useState([]);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [detailUserId, setDetailUserId] = useState(null);
  const [detailAccountId, setDetailAccountId] = useState(null);

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

  useEffect(() => {
    setSearch('');
  }, [activeTab]);

  const q = search.trim().toLowerCase();

  const filteredUsers = useMemo(() => users.filter((u) =>
    !q || u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q),
  ), [users, q]);

  const filteredAccounts = useMemo(() => accounts.filter((a) => {
    if (!q) return true;
    const email = userById[a.user_id]?.email || '';
    return a.name?.toLowerCase().includes(q)
      || a.broker?.toLowerCase().includes(q)
      || email.toLowerCase().includes(q);
  }), [accounts, q, userById]);

  const filteredKeys = useMemo(() => syncKeys.filter((key) => {
    if (!q) return true;
    const email = userById[key.user_id]?.email || '';
    const acct = accountById[key.trading_account_id]?.name || '';
    return email.toLowerCase().includes(q) || acct.toLowerCase().includes(q);
  }), [syncKeys, q, userById, accountById]);

  const filteredTeams = useMemo(() => teams.filter((team) => {
    if (!q) return true;
    return team.name?.toLowerCase().includes(q)
      || team.tag?.toLowerCase().includes(q)
      || (userById[team.created_by]?.email || '').toLowerCase().includes(q);
  }), [teams, q, userById]);

  const navCounts = useMemo(() => ({
    users: users.length,
    teams: teams.length,
    accounts: accounts.length,
    sync: syncKeys.length,
  }), [users.length, teams.length, accounts.length, syncKeys.length]);

  const page = PAGE_META[activeTab] || PAGE_META.overview;
  const showSearch = ['users', 'accounts', 'sync', 'teams'].includes(activeTab);

  async function handleToggleRole(userRow) {
    const nextRole = userRow.role === 'admin' ? 'user' : 'admin';
    const ok = await confirm({
      title: nextRole === 'admin' ? 'Promote to admin?' : 'Remove admin role?',
      message: `${userRow.email} will be set to "${nextRole}".`,
      confirmLabel: 'Confirm',
      destructive: nextRole === 'user',
    });
    if (!ok) return;
    setBusyId(userRow.id);
    try {
      await adminSetUserRole(userRow.id, nextRole);
      await loadAll();
    } catch (e) {
      await alert({ title: 'Error', message: e.message || 'Could not update role.' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteUser(userRow) {
    const ok = await confirm({
      title: `Delete user ${userRow.email}?`,
      message: 'Permanently deletes the auth account and all journal data.',
      confirmLabel: 'Delete user',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(userRow.id);
    try {
      await adminDeleteUser(userRow.id);
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

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  function openUserDetail(userId) {
    setDetailAccountId(null);
    setDetailUserId(userId);
  }

  function openAccountDetail(accountId) {
    setDetailUserId(null);
    setDetailAccountId(accountId);
  }

  async function handleToggleRoleFromDetail(profile) {
    await handleToggleRole(profile);
    // Keep drawer open; refresh list already happens in handleToggleRole.
  }

  async function handleDeleteUserFromDetail(profile) {
    await handleDeleteUser(profile);
    setDetailUserId(null);
  }

  async function handleDeleteAccountFromDetail(account) {
    await handleDeleteAccount(account);
    setDetailAccountId(null);
  }

  return (
    <div className={appShell}>
      <aside className="hidden w-52 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex lg:flex-col">
        <AdminSidebar
          active={activeTab}
          onChange={setActiveTab}
          onSignOut={handleSignOut}
          counts={navCounts}
        />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[1px]"
            aria-label="Close menu overlay"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(15rem,85vw)] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <AdminSidebar
              active={activeTab}
              onChange={setActiveTab}
              onSignOut={handleSignOut}
              onClose={() => setSidebarOpen(false)}
              counts={navCounts}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <header className="shrink-0 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3 px-4 py-4 md:px-6 xl:px-8">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <LuMenu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {page.title}
              </h1>
              <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                {page.subtitle}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {showSearch ? (
                <input
                  className={`${input} hidden w-52 sm:block md:w-72`}
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              ) : null}
              <div id="siac-header-actions" className="flex shrink-0 items-center gap-2" />
              {activeTab !== 'siac' ? (
                <button
                  type="button"
                  className={`${btnOutline} gap-2 px-3`}
                  disabled={loading}
                  onClick={loadAll}
                  title="Refresh"
                >
                  <LuRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              ) : null}
            </div>
          </div>
          {showSearch ? (
            <div className="border-t border-zinc-100 px-4 py-2.5 sm:hidden dark:border-zinc-800">
              <input
                className={input}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex h-full min-h-full w-full flex-col gap-5 p-4 md:p-6 xl:p-8">
            {error && <p className={msgError}>{error}</p>}

            {loading && activeTab !== 'siac' ? (
              <div className={`${emptyState} flex-1`}>{`Loading admin data…`}</div>
            ) : (
              <>
                {activeTab === 'siac' && <SiacRulesAdminPanel />}

                {activeTab === 'overview' && stats && (
                  <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Users" value={stats.total_users} onClick={() => setActiveTab('users')} />
                    <StatCard label="Trading accounts" value={stats.total_accounts} onClick={() => setActiveTab('accounts')} />
                    <StatCard label="Active sync keys" value={stats.active_sync_keys} onClick={() => setActiveTab('sync')} />
                    <StatCard label="Teams" value={teams.length} onClick={() => setActiveTab('teams')} />
                  </div>
                )}

                {activeTab === 'users' && (
                  <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                    <div className={cardHd}>
                      <h2 className={cardTitle}>Users ({filteredUsers.length})</h2>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className={tableTh}>User</th>
                            <th className={tableTh}>Role</th>
                            <th className={tableTh}>Accounts</th>
                            <th className={tableTh}>Keys</th>
                            <th className={`${tableTh} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {filteredUsers.map((row) => (
                            <tr
                              key={row.id}
                              className="cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                              onClick={() => openUserDetail(row.id)}
                            >
                              <td className={tableTd}>
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{row.display_name || '—'}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">{row.email}</div>
                              </td>
                              <td className={tableTd}>
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  row.role === 'admin'
                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                                >
                                  {row.role}
                                </span>
                              </td>
                              <td className={tableTd}>{row.account_count}</td>
                              <td className={tableTd}>{row.sync_key_count}</td>
                              <td className={`${tableTd} text-right`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <button
                                    className={btnOutline}
                                    type="button"
                                    onClick={() => openUserDetail(row.id)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className={btnSm}
                                    type="button"
                                    disabled={busyId === row.id}
                                    onClick={() => handleToggleRole(row)}
                                  >
                                    {row.role === 'admin' ? 'Demote' : 'Make admin'}
                                  </button>
                                  <button
                                    className={btnDanger}
                                    type="button"
                                    disabled={busyId === row.id}
                                    onClick={() => handleDeleteUser(row)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredUsers.length === 0 && <p className={emptyState}>No users match your search.</p>}
                    </div>
                  </section>
                )}

                {activeTab === 'accounts' && (
                  <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                    <div className={cardHd}>
                      <h2 className={cardTitle}>Trading accounts ({filteredAccounts.length})</h2>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="w-full min-w-[800px] border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className={tableTh}>Account</th>
                            <th className={tableTh}>User</th>
                            <th className={tableTh}>Type</th>
                            <th className={tableTh}>PnL mode</th>
                            <th className={`${tableTh} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {filteredAccounts.map((account) => (
                            <tr
                              key={account.id}
                              className="cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50"
                              onClick={() => openAccountDetail(account.id)}
                            >
                              <td className={tableTd}>
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{account.name}</div>
                                {account.broker && <div className="text-xs text-zinc-500 dark:text-zinc-400">{account.broker}</div>}
                              </td>
                              <td className={tableTd}>{userById[account.user_id]?.email || account.user_id?.slice(0, 8)}</td>
                              <td className={tableTd}>{account.account_type}</td>
                              <td className={tableTd}>{account.pnl_denomination}</td>
                              <td className={`${tableTd} text-right`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <button
                                    className={btnOutline}
                                    type="button"
                                    onClick={() => openAccountDetail(account.id)}
                                  >
                                    View
                                  </button>
                                  <button
                                    className={btnDanger}
                                    type="button"
                                    disabled={busyId === account.id}
                                    onClick={() => handleDeleteAccount(account)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredAccounts.length === 0 && <p className={emptyState}>No accounts match your search.</p>}
                    </div>
                  </section>
                )}

                {activeTab === 'sync' && (
                  <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                    <div className={cardHd}>
                      <h2 className={cardTitle}>EA sync keys ({filteredKeys.length})</h2>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="w-full min-w-[700px] border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className={tableTh}>User</th>
                            <th className={tableTh}>Trading account</th>
                            <th className={tableTh}>Created</th>
                            <th className={tableTh}>Last synced</th>
                            <th className={`${tableTh} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {filteredKeys.map((key) => (
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
                      {filteredKeys.length === 0 && <p className={emptyState}>No sync keys found.</p>}
                    </div>
                  </section>
                )}

                {activeTab === 'teams' && (
                  <section className={`${card} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                    <div className={cardHd}>
                      <h2 className={cardTitle}>Teams ({filteredTeams.length})</h2>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="w-full min-w-[700px] border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className={tableTh}>Team</th>
                            <th className={tableTh}>Creator</th>
                            <th className={tableTh}>Created</th>
                            <th className={`${tableTh} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {filteredTeams.map((team) => (
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
                      {filteredTeams.length === 0 && <p className={emptyState}>No teams found.</p>}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {detailUserId ? (
        <AdminUserDetailDrawer
          userId={detailUserId}
          busyId={busyId}
          onClose={() => setDetailUserId(null)}
          onOpenAccount={openAccountDetail}
          onToggleRole={handleToggleRoleFromDetail}
          onDeleteUser={handleDeleteUserFromDetail}
        />
      ) : null}

      {detailAccountId ? (
        <AdminAccountDetailDrawer
          accountId={detailAccountId}
          busyId={busyId}
          onClose={() => setDetailAccountId(null)}
          onBackToUser={openUserDetail}
          onDeleteAccount={handleDeleteAccountFromDetail}
        />
      ) : null}
    </div>
  );
}
