import { SUPABASE_URL, authFetch, authHeaders, getToken } from './auth';
import { MAX_TRADING_ACCOUNTS } from '../lib/accounts';
import { MAX_BACKTESTS } from './backtests';

/** Used when the limits migration has not been applied yet. */
export const DEFAULT_LIMITS = {
  maxTradingAccounts: MAX_TRADING_ACCOUNTS,
  maxBacktests: MAX_BACKTESTS,
};

async function rpc(name, body = {}) {
  const res = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function toLimits(row) {
  return {
    maxTradingAccounts: Number(row?.max_trading_accounts ?? DEFAULT_LIMITS.maxTradingAccounts),
    maxBacktests: Number(row?.max_backtests ?? DEFAULT_LIMITS.maxBacktests),
  };
}

/** Effective limits for the signed-in user (per-user override, else platform default). */
export async function fetchMyLimits() {
  return toLimits(await rpc('get_my_limits'));
}

/** Platform-wide defaults. */
export async function adminFetchAppLimits() {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/app_limits?select=max_trading_accounts,max_backtests,updated_at&id=eq.1`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return toLimits(rows?.[0]);
}

export async function adminUpdateAppLimits({ maxTradingAccounts, maxBacktests }) {
  return toLimits(await rpc('admin_update_app_limits', {
    p_max_trading_accounts: maxTradingAccounts,
    p_max_backtests: maxBacktests,
  }));
}

/** Pass null for a field to fall back to the platform default. */
export async function adminSetUserLimits(userId, { maxTradingAccounts, maxBacktests }) {
  return rpc('admin_set_user_limits', {
    target_user_id: userId,
    p_max_trading_accounts: maxTradingAccounts,
    p_max_backtests: maxBacktests,
  });
}
