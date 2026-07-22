import { useState } from 'react';
import { LuTriangleAlert, LuX } from 'react-icons/lu';
import { joinTeam } from '../../api/teams';
import { btnOutline, btnPrimary } from '../../lib/ui';

export default function JoinTeamModal({ isOpen, onClose, onSuccess, teams = [], tradingAccounts = [] }) {
  const [tab, setTab] = useState('browse'); // 'browse' | 'code'
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const publishedAccounts = tradingAccounts.filter((a) => a.is_public);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (tab === 'browse' && !selectedTeamId) {
      setError('Please select a team to join.');
      return;
    }
    if (tab === 'code' && !inviteCode.trim()) {
      setError('Please enter a team invite code.');
      return;
    }

    setLoading(true);
    try {
      const result = await joinTeam({
        teamId: tab === 'browse' ? selectedTeamId : null,
        inviteCode: tab === 'code' ? inviteCode.trim() : null,
        accountId: accountId || null,
      });
      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to join team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all">
        <div className="border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">Join a Team</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close"
            >
              <LuX className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Join an existing team to combine your trading stats with teammates.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-zinc-100 px-6 pt-3">
          <button
            type="button"
            onClick={() => setTab('browse')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === 'browse'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Browse Teams
          </button>
          <button
            type="button"
            onClick={() => setTab('code')}
            className={`border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === 'code'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Use Invite Code
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {tab === 'browse' ? (
            <div>
              <label className="block font-semibold text-zinc-700 mb-1.5">Select Team</label>
              {teams.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-400">
                  No public teams available. You can create one or use an invite code!
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-zinc-200 p-2">
                  {teams.map((t) => (
                    <label
                      key={t.teamId}
                      className={`flex items-center justify-between rounded-lg p-2.5 cursor-pointer transition ${
                        selectedTeamId === t.teamId
                          ? 'bg-violet-50 border border-violet-200'
                          : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="team_select"
                          value={t.teamId}
                          checked={selectedTeamId === t.teamId}
                          onChange={() => setSelectedTeamId(t.teamId)}
                          className="accent-violet-600"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: t.color || '#7c3aed' }}
                            />
                            <span className="font-bold text-zinc-900">{t.teamName}</span>
                            <span className="text-[10px] font-bold text-zinc-400">[{t.teamTag}]</span>
                          </div>
                          {t.description && (
                            <p className="text-[11px] text-zinc-500 line-clamp-1">{t.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px]">
                        <span className="font-semibold text-zinc-700">{t.memberCount} members</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Invite Code</label>
              <input
                type="text"
                required={tab === 'code'}
                placeholder="e.g. A1B2C3D4"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono font-bold tracking-widest text-zinc-900 focus:border-violet-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">
              Representing Account
            </label>
            {publishedAccounts.length === 0 ? (
              <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                <LuTriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  You don't have any published trading accounts yet. You can join the team now, and link a published account later in Settings.
                </span>
              </div>
            ) : (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
              >
                <option value="">-- Select Published Account --</option>
                {publishedAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={`${btnOutline} !px-4 !py-2 text-xs`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${btnPrimary} !px-5 !py-2 text-xs font-semibold`}
            >
              {loading ? 'Joining…' : 'Join Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
