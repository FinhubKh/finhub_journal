import { useState } from 'react';
import { createTeam } from '../../api/teams';
import { btnOutline, btnPrimary } from '../../lib/ui';
import { ACCOUNT_COLORS } from '../../lib/accounts';

export default function CreateTeamModal({ isOpen, onClose, onSuccess, tradingAccounts = [] }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const publishedAccounts = tradingAccounts.filter((a) => a.is_public);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createTeam({
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        description: description.trim(),
        color,
        accountId: accountId || null,
      });
      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl transition-all">
        <div className="border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">Create New Team</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Form a trading clan and compete with other teams on the leaderboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-semibold text-zinc-700 mb-1">
                Team Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={30}
                placeholder="e.g. Bullish Traders"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Tag <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={5}
                placeholder="BULL"
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold uppercase tracking-wider text-zinc-900 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Description</label>
            <textarea
              rows={2}
              maxLength={150}
              placeholder="What is your team's focus or motto?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1.5">Team Color Theme</label>
            <div className="flex items-center gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition ${
                    color === c ? 'scale-110 ring-2 ring-violet-600 ring-offset-2' : 'hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-700 mb-1">
              Representing Account
            </label>
            {publishedAccounts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                ⚠️ You don't have any published trading accounts yet. Your team will be created, but to contribute PnL to your team rank, publish an account in <strong>Settings → Trading Accounts</strong>.
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
              {loading ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
