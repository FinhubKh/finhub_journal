import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LuGlobe, LuHandshake, LuMoon, LuShield, LuSun, LuUsers } from 'react-icons/lu';
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
import { BrandLogo } from '../components/BrandLogo';

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
  let podium = 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700/60';
  if (rank === 1) {
    podium = 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-gradient-to-br dark:from-amber-400 dark:to-yellow-500 dark:text-zinc-950 dark:border-amber-300 dark:shadow-[0_0_12px_rgba(245,158,11,0.45)] dark:font-black';
  } else if (rank === 2) {
    podium = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-gradient-to-br dark:from-slate-200 dark:to-zinc-400 dark:text-zinc-950 dark:border-slate-300 dark:shadow-[0_0_8px_rgba(203,213,225,0.3)] dark:font-black';
  } else if (rank === 3) {
    podium = 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-gradient-to-br dark:from-amber-600 dark:to-amber-700 dark:text-white dark:border-amber-400 dark:shadow-[0_0_8px_rgba(217,119,6,0.3)] dark:font-bold';
  }

  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums border ${podium}`}>
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
          <Link to="/dashboard/accounts" className={`${btnOutline} mt-4 inline-flex`}>
            Go to Accounts
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
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90">
              <th className={`${tableTh} w-14 text-zinc-500 dark:text-zinc-400`}>#</th>
              <th className={`${tableTh} text-zinc-500 dark:text-zinc-400`}>Trader</th>
              <th className={`${tableTh} text-zinc-500 dark:text-zinc-400`}>Account</th>
              <th className={`${tableTh} text-right ${sort === 'pnl' ? 'text-violet-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>Net PnL</th>
              <th className={`${tableTh} text-right ${sort === 'wr' ? 'text-violet-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>Win rate</th>
              <th className={`${tableTh} text-right ${sort === 'pf' ? 'text-violet-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>PF</th>
              <th className={`${tableTh} text-right text-zinc-500 dark:text-zinc-400`}>Trades</th>
              <th className={`${tableTh} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {entries.map((e) => {
              const isFirst = e.displayRank === 1;
              const rowClass = isFirst
                ? 'bg-amber-500/[0.02] dark:bg-amber-500/[0.06] hover:bg-amber-500/[0.05] dark:hover:bg-amber-500/[0.10]'
                : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50';

              return (
                <tr key={e.accountId} className={`transition ${rowClass}`}>
                  <td className={tableTd}>
                    <RankBadge rank={e.displayRank} />
                  </td>
                  <td className={tableTd}>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{e.displayName}</div>
                  </td>
                  <td className={tableTd}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: e.color || '#7c3aed' }}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">{e.accountName}</div>
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{accountTypeLabel(e.accountType)}</div>
                      </div>
                    </div>
                  </td>
                  <td
                    className={`${tableTd} text-right tabular-nums font-bold ${
                      e.totalPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {fmtPnl(e.totalPnl)}
                  </td>
                  <td className={`${tableTd} text-right tabular-nums text-zinc-800 dark:text-zinc-200 font-medium`}>{e.winRate}%</td>
                  <td className={`${tableTd} text-right tabular-nums text-zinc-800 dark:text-zinc-200 font-medium`}>{fmtPf(e.profitFactor)}</td>
                  <td className={`${tableTd} text-right tabular-nums text-zinc-500 dark:text-zinc-400`}>{e.tradeCount}</td>
                  <td className={`${tableTd} text-right`}>
                    {e.shareToken ? (
                      <Link
                        to={`/share/${e.shareToken}`}
                        className="text-xs font-semibold text-violet-600 dark:text-emerald-400 transition hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
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
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90">
              <th className={`${tableTh} w-14 text-zinc-500 dark:text-zinc-400`}>#</th>
              <th className={`${tableTh} text-zinc-500 dark:text-zinc-400`}>Team</th>
              <th className={`${tableTh} text-zinc-500 dark:text-zinc-400`}>Leader</th>
              <th className={`${tableTh} text-center text-zinc-500 dark:text-zinc-400`}>Members</th>
              <th className={`${tableTh} text-right text-zinc-500 dark:text-zinc-400`}>Win Rate</th>
              <th className={`${tableTh} text-right text-zinc-500 dark:text-zinc-400`}>Trades</th>
              <th className={`${tableTh} text-right text-violet-700 dark:text-emerald-400`}>Combined PnL</th>
              <th className={`${tableTh} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {teams.map((t) => {
              const isFirst = t.rank === 1;
              const rowClass = isFirst
                ? 'bg-amber-500/[0.02] dark:bg-amber-500/[0.06] hover:bg-amber-500/[0.05] dark:hover:bg-amber-500/[0.10]'
                : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50';

              return (
                <tr key={t.teamId} className={`transition ${rowClass}`}>
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
                          <span className="font-extrabold text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-emerald-400 transition">
                            {t.teamName}
                          </span>
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400">
                            [{t.teamTag}]
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 line-clamp-1 max-w-xs">{t.description}</p>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className={tableTd}>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.leaderName}</span>
                  </td>
                  <td className={`${tableTd} text-center tabular-nums font-bold text-zinc-700 dark:text-zinc-300`}>
                    {t.memberCount}
                  </td>
                  <td className={`${tableTd} text-right tabular-nums text-zinc-800 dark:text-zinc-200 font-medium`}>{t.winRate}%</td>
                  <td className={`${tableTd} text-right tabular-nums text-zinc-500 dark:text-zinc-400`}>{t.tradeCount}</td>
                  <td
                    className={`${tableTd} text-right tabular-nums font-black ${
                      t.totalPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {fmtPnl(t.totalPnl)}
                  </td>
                  <td className={`${tableTd} text-right`}>
                    <button
                      type="button"
                      onClick={() => onSelectTeam(t.teamId)}
                      className="rounded-lg bg-violet-50 dark:bg-emerald-950/40 border border-violet-200 dark:border-emerald-500/30 px-3 py-1 text-xs font-bold text-violet-700 dark:text-emerald-400 transition hover:bg-violet-100 dark:hover:bg-emerald-900/50"
                    >
                      View Team
                    </button>
                  </td>
                </tr>
              );
            })}
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
              <span className="inline-flex items-center gap-1.5">
                <LuGlobe className="h-3.5 w-3.5" aria-hidden />
                Global
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'teams'}
              className={pillBtn(mode === 'teams')}
              onClick={() => setMode('teams')}
            >
              <span className="inline-flex items-center gap-1.5">
                <LuUsers className="h-3.5 w-3.5" aria-hidden />
                Team
              </span>
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
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-200 dark:border-zinc-800 bg-gradient-to-r from-violet-50/80 via-white to-violet-50/50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                  style={{ backgroundColor: userTeam.teamColor || '#7c3aed' }}
                >
                  <LuShield className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{userTeam.teamName}</span>
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400">
                      [{userTeam.teamTag}]
                    </span>
                    <span className="rounded bg-violet-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-extrabold text-violet-800 dark:text-emerald-400 uppercase border border-violet-200/50 dark:border-emerald-500/30">
                      {userTeam.role}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      Representing Account:{' '}
                      <select
                        value={userTeam.accountId || ''}
                        onChange={handleAccountChange}
                        className="ml-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
                  className={`${btnOutline} !px-3 !py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/50`}
                >
                  {leavingTeam ? 'Leaving…' : 'Leave Team'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">You are not in a Team</h3>
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
                  <span className="inline-flex items-center gap-1.5">
                    <LuHandshake className="h-3.5 w-3.5" aria-hidden />
                    Join Team
                  </span>
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
          <BrandLogo size="sm" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`${btnOutline} !px-3 !py-2 text-xs`}
              title="Toggle Dark/Light Mode"
            >
              <span className="inline-flex items-center gap-1.5">
                {isDark ? <LuMoon className="h-3.5 w-3.5" aria-hidden /> : <LuSun className="h-3.5 w-3.5" aria-hidden />}
                {isDark ? 'Dark' : 'Light'}
              </span>
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
