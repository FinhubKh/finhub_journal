import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getCachedPublicLeaderboard } from '../lib/leaderboardCache';
import { fetchTeamsLeaderboard, fetchMyTeam, leaveTeam, updateTeamAccount } from '../api/teams';
import { accountTypeLabel } from '../lib/accounts';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { useTheme } from '../context/ThemeContext';
import TeamDetailsModal from '../components/leaderboard/TeamDetailsModal';
import CreateTeamModal from '../components/leaderboard/CreateTeamModal';
import JoinTeamModal from '../components/leaderboard/JoinTeamModal';
import {
  btnOutline,
  btnPrimary,
  card,
  dashboardPageWide,
  emptyState,
  pageShell,
  pillBtn,
  pillToggle,
  sectionLabel,
  tableTd,
  tableTh,
} from '../lib/ui';

const SORTS = [
  { id: 'pnl', label: 'Net PnL' },
  { id: 'wr', label: 'Win rate' },
  { id: 'pf', label: 'Profit factor' },
];

function fmtPnl(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function fmtPf(v) {
  if (v === Infinity) return '∞';
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toFixed(2);
}

function pfSortValue(v) {
  if (v === Infinity) return Number.POSITIVE_INFINITY;
  if (v == null || Number.isNaN(v)) return Number.NEGATIVE_INFINITY;
  return Number(v);
}

function RankBadge({ rank }) {
  const podium =
    rank === 1
      ? 'bg-amber-100 text-amber-800 ring-amber-200'
      : rank === 2
        ? 'bg-zinc-100 text-zinc-700 ring-zinc-200'
        : rank === 3
          ? 'bg-orange-50 text-orange-800 ring-orange-200'
          : 'bg-zinc-50 text-zinc-500 ring-zinc-200';
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums ring-1 ring-inset ${podium}`}>
      {rank}
    </span>
  );
}

function GlobalLeaderboardTable({ entries, sort, embedded }) {
  if (!entries.length) {
    return (
      <div className={`${card} ${emptyState}`}>
        <p>No published accounts qualify yet.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Publish an account with enough trades to appear here.
        </p>
        {embedded ? (
          <Link to="/dashboard" state={{ tab: 'settings', section: 'trading-accounts' }} className={`${btnOutline} mt-4 inline-flex`}>
            Go to Settings
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className={`${tableTh} w-14`}>#</th>
              <th className={tableTh}>Trader</th>
              <th className={tableTh}>Account</th>
              <th className={`${tableTh} text-right ${sort === 'pnl' ? 'text-violet-700' : ''}`}>Net PnL</th>
              <th className={`${tableTh} text-right ${sort === 'wr' ? 'text-violet-700' : ''}`}>Win rate</th>
              <th className={`${tableTh} text-right ${sort === 'pf' ? 'text-violet-700' : ''}`}>PF</th>
              <th className={`${tableTh} text-right`}>Trades</th>
              <th className={`${tableTh} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {entries.map((e) => (
              <tr key={e.accountId} className="hover:bg-zinc-50/80">
                <td className={tableTd}>
                  <RankBadge rank={e.displayRank} />
                </td>
                <td className={tableTd}>
                  <div className="font-semibold text-zinc-900">{e.displayName}</div>
                </td>
                <td className={tableTd}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color || '#7c3aed' }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-800">{e.accountName}</div>
                      <div className="text-[11px] text-zinc-400">{accountTypeLabel(e.accountType)}</div>
                    </div>
                  </div>
                </td>
                <td
                  className={`${tableTd} text-right tabular-nums font-semibold ${e.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'
                    }`}
                >
                  {fmtPnl(e.totalPnl)}
                </td>
                <td className={`${tableTd} text-right tabular-nums`}>{e.winRate}%</td>
                <td className={`${tableTd} text-right tabular-nums`}>{fmtPf(e.profitFactor)}</td>
                <td className={`${tableTd} text-right tabular-nums text-zinc-500`}>{e.tradeCount}</td>
                <td className={`${tableTd} text-right`}>
                  {e.shareToken ? (
                    <Link
                      to={`/share/${e.shareToken}`}
                      className="text-xs font-semibold text-violet-600 transition hover:text-violet-500"
                    >
                      View
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamLeaderboardTable({ teams, onSelectTeam }) {
  if (!teams.length) {
    return (
      <div className={`${card} ${emptyState}`}>
        <p>No teams have been created yet.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Be the first to create a team and start competing!
        </p>
      </div>
    );
  }

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className={`${tableTh} w-14`}>#</th>
              <th className={tableTh}>Team</th>
              <th className={tableTh}>Leader</th>
              <th className={`${tableTh} text-center`}>Members</th>
              <th className={`${tableTh} text-right`}>Win Rate</th>
              <th className={`${tableTh} text-right`}>Trades</th>
              <th className={`${tableTh} text-right text-violet-700`}>Combined PnL</th>
              <th className={`${tableTh} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {teams.map((t) => (
              <tr key={t.teamId} className="hover:bg-zinc-50/80 transition">
                <td className={tableTd}>
                  <RankBadge rank={t.rank} />
                </td>
                <td className={tableTd}>
                  <button
                    type="button"
                    onClick={() => onSelectTeam(t.teamId)}
                    className="flex items-center gap-2 text-left group"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color || '#7c3aed' }}
                      aria-hidden
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-zinc-900 group-hover:text-violet-600 transition">
                          {t.teamName}
                        </span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-zinc-600">
                          [{t.teamTag}]
                        </span>
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-xs">{t.description}</p>
                      )}
                    </div>
                  </button>
                </td>
                <td className={tableTd}>
                  <span className="font-semibold text-zinc-800">{t.leaderName}</span>
                </td>
                <td className={`${tableTd} text-center tabular-nums font-bold text-zinc-700`}>
                  {t.memberCount}
                </td>
                <td className={`${tableTd} text-right tabular-nums`}>{t.winRate}%</td>
                <td className={`${tableTd} text-right tabular-nums text-zinc-500`}>{t.tradeCount}</td>
                <td
                  className={`${tableTd} text-right tabular-nums font-black ${t.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'
                    }`}
                >
                  {fmtPnl(t.totalPnl)}
                </td>
                <td className={`${tableTd} text-right`}>
                  <button
                    type="button"
                    onClick={() => onSelectTeam(t.teamId)}
                    className="rounded-lg bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                  >
                    View Team
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useSafeAppData() {
  try {
    return useAppData();
  } catch {
    return { tradingAccounts: [] };
  }
}

/**
 * LeaderboardPage Component
 */
export default function LeaderboardPage({ embedded = false }) {
  const { isAuthenticated } = useAuth();
  const { tradingAccounts } = useSafeAppData();
  const { isDark, toggleTheme } = useTheme();

  const [mode, setMode] = useState('global'); // 'global' | 'teams'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global payload
  const [globalPayload, setGlobalPayload] = useState(null);
  const [sort, setSort] = useState('pnl');

  // Teams payload
  const [teamsPayload, setTeamsPayload] = useState([]);
  const [userTeam, setUserTeam] = useState(null);

  // Modals state
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [leavingTeam, setLeavingTeam] = useState(false);

  // Load Global Leaderboard
  const loadGlobal = useCallback(() => {
    setLoading(true);
    setError(null);
    getCachedPublicLeaderboard({ limit: 50, minTrades: 5 })
      .then((data) => setGlobalPayload(data))
      .catch((e) => setError(e?.message || 'Could not load global leaderboard.'))
      .finally(() => setLoading(false));
  }, []);

  // Load Teams Leaderboard & User Team
  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamsData, myTeamData] = await Promise.all([
        fetchTeamsLeaderboard({ limit: 50 }),
        isAuthenticated ? fetchMyTeam().catch(() => null) : Promise.resolve(null),
      ]);
      setTeamsPayload(teamsData?.entries || []);
      setUserTeam(myTeamData);
    } catch (e) {
      setError(e?.message || 'Could not load teams leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (mode === 'global') {
      loadGlobal();
    } else {
      loadTeams();
    }
  }, [mode, loadGlobal, loadTeams]);

  // Sorted global entries
  const sortedGlobal = useMemo(() => {
    const list = [...(globalPayload?.entries || [])];
    if (sort === 'wr') {
      list.sort((a, b) => b.winRate - a.winRate || b.totalPnl - a.totalPnl);
    } else if (sort === 'pf') {
      list.sort((a, b) => pfSortValue(b.profitFactor) - pfSortValue(a.profitFactor) || b.totalPnl - a.totalPnl);
    } else {
      list.sort((a, b) => b.totalPnl - a.totalPnl || b.tradeCount - a.tradeCount);
    }
    return list.map((e, i) => ({ ...e, displayRank: i + 1 }));
  }, [globalPayload, sort]);

  const handleLeaveTeam = async () => {
    if (!window.confirm('Are you sure you want to leave your team?')) return;
    setLeavingTeam(true);
    try {
      await leaveTeam();
      await loadTeams();
    } catch (e) {
      alert(e?.message || 'Could not leave team.');
    } finally {
      setLeavingTeam(false);
    }
  };

  const handleAccountChange = async (e) => {
    const accId = e.target.value;
    try {
      await updateTeamAccount(accId);
      await loadTeams();
    } catch (err) {
      alert(err?.message || 'Could not update account.');
    }
  };

  const publishedAccounts = (tradingAccounts || []).filter((a) => a.is_public);

  const body = (
    <>
      {/* Top Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`${sectionLabel} !mb-1`}>Community Rankings</p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Leaderboard</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            {mode === 'global'
              ? 'Rankings of published trading accounts. Open any profile to view performance stats.'
              : 'Clan battleground! Teams ranked by combined total PnL across all team members.'}
          </p>
        </div>

        {/* Dual Mode Switch */}
        <div className="flex items-center gap-3">
          <div className={pillToggle} role="tablist" aria-label="Leaderboard type">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'global'}
              className={pillBtn(mode === 'global')}
              onClick={() => setMode('global')}
            >
              🌐 Global
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'teams'}
              className={pillBtn(mode === 'teams')}
              onClick={() => setMode('teams')}
            >
              📌 Team
            </button>
          </div>

          {mode === 'global' && (
            <div className={pillToggle} role="tablist" aria-label="Sort global leaderboard">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={sort === s.id}
                  className={pillBtn(sort === s.id)}
                  onClick={() => setSort(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Mode Banner & Quick Actions */}
      {mode === 'teams' && (
        <div className="mb-6">
          {userTeam ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/80 via-white to-violet-50/50 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-3.5">
                <span
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-lg text-white shadow-xs"
                  style={{ backgroundColor: userTeam.teamColor || '#7c3aed' }}
                >
                  🛡️
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-zinc-900">{userTeam.teamName}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-zinc-600">
                      [{userTeam.teamTag}]
                    </span>
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-violet-800 uppercase">
                      {userTeam.role}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                    <span>
                      Representing Account:{' '}
                      <select
                        value={userTeam.accountId || ''}
                        onChange={handleAccountChange}
                        className="ml-1 rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-800 focus:outline-none"
                      >
                        <option value="">-- None --</option>
                        {publishedAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeamId(userTeam.teamId)}
                  className={`${btnPrimary} !px-4 !py-2 text-xs`}
                >
                  View My Team Details
                </button>
                <button
                  type="button"
                  onClick={handleLeaveTeam}
                  disabled={leavingTeam}
                  className={`${btnOutline} !px-3 !py-2 text-xs text-rose-600 hover:bg-rose-50 border-rose-200`}
                >
                  {leavingTeam ? 'Leaving…' : 'Leave Team'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">You are not in a Team</h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Join an existing team or create your own to compete on the Team Leaderboard.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className={`${btnOutline} !px-4 !py-2 text-xs`}
                >
                  🤝 Join Team
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className={`${btnPrimary} !px-4 !py-2 text-xs`}
                >
                  + Create Team
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading {mode === 'global' ? 'traders' : 'teams'}…</p>
      ) : error ? (
        <div className={`${card} p-5`}>
          <p className="text-sm font-medium text-zinc-900">Could not load leaderboard</p>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
          <p className="mt-3 text-xs text-zinc-400">
            Run SQL schemas <code className="rounded bg-zinc-100 px-1 py-0.5">backend/schema_leaderboard.sql</code> and <code className="rounded bg-zinc-100 px-1 py-0.5">backend/schema_teams.sql</code> in Supabase SQL Editor.
          </p>
        </div>
      ) : mode === 'global' ? (
        <GlobalLeaderboardTable entries={sortedGlobal} sort={sort} embedded={embedded} />
      ) : (
        <TeamLeaderboardTable teams={teamsPayload} onSelectTeam={(id) => setSelectedTeamId(id)} />
      )}

      {/* Modals */}
      <TeamDetailsModal
        teamId={selectedTeamId}
        isOpen={Boolean(selectedTeamId)}
        onClose={() => setSelectedTeamId(null)}
      />

      <CreateTeamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadTeams();
        }}
        tradingAccounts={tradingAccounts}
      />

      <JoinTeamModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={() => {
          setIsJoinModalOpen(false);
          loadTeams();
        }}
        teams={teamsPayload}
        tradingAccounts={tradingAccounts}
      />
    </>
  );

  if (embedded) {
    return <div className={`${dashboardPageWide} !pt-6`}>{body}</div>;
  }

  return (
    <div className={pageShell}>
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
        <div className={`${dashboardPageWide} flex flex-wrap items-center justify-between gap-3 !pb-4 !pt-4`}>
          <Link to="/" className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            FinhubKH <span className="font-medium text-zinc-400">Journal</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`${btnOutline} !px-3 !py-2 text-xs`}
              title="Toggle Dark/Light Mode"
            >
              {isDark ? '🌙 Dark' : '☀️ Light'}
            </button>
            <Link to="/login" className={`${btnOutline} !px-4 !py-2 text-xs`}>
              Sign in
            </Link>
            <Link to="/login" className={`${btnPrimary} !px-4 !py-2 text-xs`}>
              Open your journal
            </Link>
          </div>
        </div>
      </header>
      <main className={`${dashboardPageWide} !pt-6`}>{body}</main>
    </div>
  );
}
