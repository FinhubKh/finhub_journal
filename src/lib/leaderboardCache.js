import { fetchPublicLeaderboard } from '../api/share';

const TTL_MS = 90_000;

/** @type {Map<string, { at: number, data: any, inflight?: Promise<any> }>} */
const cache = new Map();

function cacheKey(opts = {}) {
  const limit = Number.isFinite(opts.limit) ? opts.limit : 50;
  const minTrades = Number.isFinite(opts.minTrades) ? opts.minTrades : 5;
  return `${limit}:${minTrades}`;
}

export function invalidateLeaderboardCache() {
  cache.clear();
}

/**
 * Shared leaderboard fetch with short TTL so Landing + Overview + tab
 * do not each hit Supabase on every mount.
 */
export async function getCachedPublicLeaderboard(opts = {}) {
  const key = cacheKey(opts);
  const hit = cache.get(key);
  const now = Date.now();

  if (hit?.data && now - hit.at < TTL_MS) {
    return hit.data;
  }

  if (hit?.inflight) {
    return hit.inflight;
  }

  const inflight = fetchPublicLeaderboard(opts)
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .catch((err) => {
      cache.delete(key);
      throw err;
    });

  cache.set(key, { at: hit?.at || 0, data: hit?.data || null, inflight });
  return inflight;
}
