import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicLeaderboard } from '../../api/share';
import { btnPrimary, card, cardHd, cardTitle, sectionLabel } from '../../lib/ui';

function fmtPnl(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
}

function initials(name) {
  const parts = String(name || 'T').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'T';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function RankMark({ rank }) {
  const tone =
    rank === 1
      ? 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200'
      : rank === 2
        ? 'bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200'
        : rank === 3
          ? 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200'
          : 'bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200';
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${tone}`}>
      {rank}
    </span>
  );
}

function Avatar({ name, color, size = 'md' }) {
  const sizeCls = size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-sm';
  return (
    <span
      className={`inline-flex ${sizeCls} shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-sm ring-2 ring-white`}
      style={{ backgroundColor: color || '#7c3aed' }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function WinRateBar({ rate }) {
  const clamped = Math.max(0, Math.min(100, Number(rate) || 0));
  return (
    <div className="w-full max-w-[120px]">
      <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        <span>WR</span>
        <span className="tabular-nums text-zinc-600">{clamped}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function PodiumCard({ entry, rank }) {
  const podium =
    rank === 1
      ? {
          order: 'order-1 md:order-2',
          shell: 'md:-mt-4 border-violet-200 bg-gradient-to-b from-violet-50 via-white to-white shadow-md shadow-violet-100/80 ring-1 ring-violet-100',
          badge: 'bg-violet-600 text-white',
          label: '1st',
        }
      : rank === 2
        ? {
            order: 'order-2 md:order-1',
            shell: 'border-zinc-200 bg-gradient-to-b from-zinc-50 to-white',
            badge: 'bg-zinc-700 text-white',
            label: '2nd',
          }
        : {
            order: 'order-3 md:order-3',
            shell: 'border-orange-200/80 bg-gradient-to-b from-orange-50/80 to-white',
            badge: 'bg-orange-600 text-white',
            label: '3rd',
          };

  return (
    <Link
      to={`/share/${entry.shareToken}`}
      className={`${podium.order} group relative flex flex-col items-center rounded-2xl border px-5 pb-5 pt-6 text-center transition duration-300 hover:-translate-y-1 hover:shadow-lg ${podium.shell}`}
    >
      <span className={`absolute -top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${podium.badge}`}>
        {podium.label}
      </span>
      <div className="min-w-0">
        <div className="truncate text-base font-bold text-zinc-900 group-hover:text-violet-700">{entry.displayName}</div>
        <div className="mt-0.5 truncate text-xs text-zinc-400">{entry.accountName}</div>
      </div>
      <div
        className={`mt-4 text-2xl font-extrabold tracking-tight tabular-nums ${
          entry.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'
        }`}
      >
        {fmtPnl(entry.totalPnl)}
      </div>
      <div className="mt-3 flex w-full max-w-[160px] flex-col items-center gap-2">
        <WinRateBar rate={entry.winRate} />
        <span className="text-[11px] text-zinc-400">{entry.tradeCount} trades</span>
      </div>
    </Link>
  );
}

function LandingLeaderboardTable({ entries }) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="mt-10 space-y-8">
      {top3.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
          {top3.map((e, i) => (
            <PodiumCard key={e.accountId} entry={e} rank={i + 1} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/90 px-4 py-3 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Ranks 4–{3 + rest.length}
            </p>
            <p className="hidden text-[11px] text-zinc-400 sm:block">Tap a row to open their shared journal</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <th className="w-16 px-4 py-3 sm:px-5">Rank</th>
                  <th className="px-4 py-3 sm:px-5">Trader</th>
                  <th className="hidden w-[140px] px-4 py-3 sm:table-cell sm:px-5">Win rate</th>
                  <th className="w-20 px-4 py-3 text-right sm:px-5">Trades</th>
                  <th className="w-28 px-4 py-3 text-right sm:px-5">Net PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {rest.map((e, i) => {
                  const rank = i + 4;
                  return (
                    <tr key={e.accountId} className="group transition hover:bg-violet-50/50">
                      <td className="px-4 py-3.5 sm:px-5">
                        <Link to={`/share/${e.shareToken}`} className="inline-flex">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-xs font-bold tabular-nums text-zinc-600 transition group-hover:bg-violet-100 group-hover:text-violet-700">
                            {rank}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 sm:px-5">
                        <Link to={`/share/${e.shareToken}`} className="flex min-w-0 items-center gap-3">
                          <Avatar name={e.displayName} color={e.color} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-zinc-900 group-hover:text-violet-700">
                              {e.displayName}
                            </div>
                            <div className="truncate text-xs text-zinc-400">{e.accountName}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 sm:table-cell sm:px-5">
                        <Link to={`/share/${e.shareToken}`} className="block">
                          <WinRateBar rate={e.winRate} />
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right sm:px-5">
                        <Link to={`/share/${e.shareToken}`} className="text-sm tabular-nums text-zinc-500">
                          {e.tradeCount}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right sm:px-5">
                        <Link
                          to={`/share/${e.shareToken}`}
                          className={`text-sm font-bold tabular-nums ${
                            e.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'
                          }`}
                        >
                          {fmtPnl(e.totalPnl)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact top traders strip.
 * @param {{ limit?: number, variant?: 'card' | 'landing', seeAllTo?: string, onSeeAllTab?: string }} props
 */
export default function LeaderboardPreview({
  limit = 5,
  variant = 'card',
  seeAllTo = '/leaderboard',
  seeAllState = null,
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchPublicLeaderboard({ limit, minTrades: 5 })
      .then((data) => {
        if (cancelled) return;
        setEntries((data.entries || []).slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const seeAllProps = seeAllState
    ? { to: '/dashboard', state: seeAllState }
    : { to: seeAllTo };

  if (variant === 'landing') {
    return (
      <section
        id="leaderboard"
        className="relative overflow-hidden border-b border-zinc-100 bg-gradient-to-b from-violet-50/60 via-white to-zinc-50 py-20"
      >
        <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-fuchsia-200/25 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">Community</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              Who is on top
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              Live rankings from traders who publish their accounts. Open any profile to see the full journal.
            </p>
          </div>

          {loading ? (
            <p className="mt-12 text-center text-sm text-zinc-400">Loading top traders…</p>
          ) : failed ? (
            <p className="mt-12 text-center text-sm text-zinc-400">Leaderboard is unavailable right now.</p>
          ) : entries.length === 0 ? (
            <div className={`${card} mx-auto mt-10 max-w-lg px-5 py-10 text-center`}>
              <p className="text-sm text-zinc-500">
                No published accounts qualify yet. Be the first to publish and claim the top spot.
              </p>
            </div>
          ) : (
            <LandingLeaderboardTable entries={entries} />
          )}

          <div className="mt-8 flex justify-center">
            <Link to="/leaderboard" className={`${btnPrimary} !px-6 !py-2.5 text-sm`}>
              View full leaderboard
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Leaderboard preview">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className={`${sectionLabel} !mb-0`}>Top traders</h2>
        <Link
          {...seeAllProps}
          className="text-xs font-semibold text-violet-600 transition hover:text-violet-500"
        >
          View leaderboard
        </Link>
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className={cardHd}>
          <h3 className={cardTitle}>Community leaderboard</h3>
          <span className="text-xs text-zinc-400">Published accounts</span>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">Loading…</p>
        ) : failed ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">Could not load rankings.</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-400">
            No published accounts yet. Publish yours from Settings to appear here.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {entries.map((e, i) => (
              <li key={e.accountId}>
                <Link
                  to={`/share/${e.shareToken}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 md:px-5"
                >
                  <RankMark rank={i + 1} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-900">{e.displayName}</div>
                    <div className="truncate text-[11px] text-zinc-400">
                      {e.accountName} · {e.winRate}% WR
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold tabular-nums ${
                      e.totalPnl >= 0 ? 'text-violet-600' : 'text-rose-600'
                    }`}
                  >
                    {fmtPnl(e.totalPnl)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
