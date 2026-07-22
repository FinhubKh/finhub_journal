import { useEffect, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { fetchTeamDetails } from '../../api/teams';
import { accountTypeLabel } from '../../lib/accounts';
import { btnOutline, emptyState, tableTd, tableTh } from '../../lib/ui';

function fmtPnl(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function MemberRankBadge({ rank }) {
  let podium = 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-700/60';
  if (rank === 1) {
    podium = 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-gradient-to-br dark:from-amber-400 dark:to-yellow-500 dark:text-zinc-950 dark:border-amber-300 dark:shadow-[0_0_8px_rgba(245,158,11,0.45)] dark:font-black';
  } else if (rank === 2) {
    podium = 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-gradient-to-br dark:from-slate-200 dark:to-zinc-400 dark:text-zinc-950 dark:border-slate-300 dark:shadow-[0_0_6px_rgba(203,213,225,0.3)] dark:font-black';
  } else if (rank === 3) {
    podium = 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-gradient-to-br dark:from-amber-600 dark:to-amber-700 dark:text-white dark:border-amber-400 dark:shadow-[0_0_6px_rgba(217,119,6,0.3)] dark:font-bold';
  }
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold tabular-nums border ${podium}`}>
      {rank}
    </span>
  );
}

export default function TeamDetailsModal({ teamId, isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !teamId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTeamDetails(teamId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load team details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, isOpen]);

  if (!isOpen) return null;

  const team = data?.team;
  const members = data?.members || [];
  const totalPnl = members.reduce((sum, m) => sum + (m.totalPnl || 0), 0);
  const totalTrades = members.reduce((sum, m) => sum + (m.tradeCount || 0), 0);
  const totalWins = members.reduce((sum, m) => sum + (m.wins || 0), 0);
  const avgWinRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;

  const handleCopyCode = () => {
    if (!team?.inviteCode) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl transition-all">
        {/* Header Banner */}
        <div
          className="relative px-6 py-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${team?.color || '#7c3aed'}, #18181b)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/20 p-1.5 text-white/80 transition hover:bg-black/40 hover:text-white"
            aria-label="Close"
          >
            <LuX className="h-4 w-4" aria-hidden />
          </button>
          {loading ? (
            <div className="h-16 animate-pulse" />
          ) : error ? (
            <div>
              <p className="text-sm font-semibold text-rose-200">Error</p>
              <p className="text-xs text-white/80">{error}</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-white backdrop-blur-xs">
                  [{team?.tag}]
                </span>
                <h2 className="text-2xl font-black tracking-tight text-white">{team?.name}</h2>
              </div>
              {team?.description && (
                <p className="mt-2 text-xs text-white/80 max-w-lg">{team.description}</p>
              )}
              {team?.inviteCode && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[11px] font-medium text-white/70">Invite Code:</span>
                  <code className="rounded bg-black/30 px-2 py-0.5 text-xs font-bold text-amber-300">
                    {team.inviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-[11px] font-semibold text-white underline hover:text-amber-200"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Strip */}
        {!loading && !error && (
          <div className="grid grid-cols-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950/80 text-center text-xs">
            <div className="border-r border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total PnL</div>
              <div className={`mt-0.5 text-sm font-black tabular-nums ${totalPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {fmtPnl(totalPnl)}
              </div>
            </div>
            <div className="border-r border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Members</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{members.length}</div>
            </div>
            <div className="border-r border-zinc-200 dark:border-zinc-800 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Avg Win Rate</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{avgWinRate}%</div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Trades</div>
              <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{totalTrades}</div>
            </div>
          </div>
        )}

        {/* Member Rankings List */}
        <div className="max-h-[420px] overflow-y-auto p-6 bg-white dark:bg-zinc-900">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Team Member Rankings
          </h3>

          {loading ? (
            <p className="py-8 text-center text-xs text-zinc-400">Loading member data…</p>
          ) : error ? (
            <p className="py-8 text-center text-xs text-rose-500">{error}</p>
          ) : members.length === 0 ? (
            <div className={emptyState}>
              <p className="text-xs text-zinc-400">No members in this team yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
              <table className="w-full text-left min-w-[540px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-400">
                    <th className={`${tableTh} w-12 text-zinc-500 dark:text-zinc-400`}>#</th>
                    <th className={`${tableTh} text-zinc-500 dark:text-zinc-400`}>Trader</th>
                    <th className={`${tableTh} text-zinc-500 dark:text-zinc-400`}>Account</th>
                    <th className={`${tableTh} text-right text-zinc-500 dark:text-zinc-400`}>Win Rate</th>
                    <th className={`${tableTh} text-right text-zinc-500 dark:text-zinc-400`}>Trades</th>
                    <th className={`${tableTh} text-right text-zinc-500 dark:text-zinc-400`}>Net PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                  {members.map((m) => (
                    <tr key={m.memberId} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition">
                      <td className={tableTd}>
                        <MemberRankBadge rank={m.rank} />
                      </td>
                      <td className={tableTd}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{m.displayName}</span>
                          {m.role === 'leader' && (
                            <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-300 border border-amber-300/40 dark:border-amber-500/40">
                              Leader
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={tableTd}>
                        {m.accountName ? (
                          <div>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{m.accountName}</span>
                            <span className="ml-1 text-[10px] text-zinc-400">({accountTypeLabel(m.accountType)})</span>
                          </div>
                        ) : (
                          <span className="italic text-zinc-400">No account linked</span>
                        )}
                      </td>
                      <td className={`${tableTd} text-right tabular-nums font-medium text-zinc-700 dark:text-zinc-300`}>
                        {m.winRate}%
                      </td>
                      <td className={`${tableTd} text-right tabular-nums text-zinc-500 dark:text-zinc-400`}>
                        {m.tradeCount}
                      </td>
                      <td
                        className={`${tableTd} text-right tabular-nums font-bold ${
                          m.totalPnl >= 0 ? 'text-violet-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {fmtPnl(m.totalPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-6 py-4">
          <button type="button" onClick={onClose} className={`${btnOutline} !px-5 !py-2 text-xs`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
