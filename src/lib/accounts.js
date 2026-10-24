import { normalizePnlDenomination } from './format';

export { normalizePnlDenomination };

export const ACCOUNT_TYPES = [
  { value: 'live', label: 'Live' },
  { value: 'prop', label: 'Prop / Challenge' },
  { value: 'demo', label: 'Demo' },
];

export const PNL_DENOMINATIONS = [
  { value: 'usd', label: 'Standard USD' },
  { value: 'cent', label: 'Cent account' },
];

export const PLATFORMS = [
  { value: 'mt5', label: 'MetaTrader 5' },
  { value: 'mt4', label: 'MetaTrader 4' },
];

export const RISK_TRACKS = [
  { value: 'master', label: 'Master' },
  { value: 'ea', label: 'EA / ATS' },
];

/** Fallback cap; the effective per-user limit is admin-configurable (see api/limits). */
export const MAX_TRADING_ACCOUNTS = 2;

export function normalizePlatform(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'mt4' ? 'mt4' : 'mt5';
}

export function platformLabel(value) {
  return normalizePlatform(value) === 'mt4' ? 'MetaTrader 4' : 'MetaTrader 5';
}

/** Short label for badges and sync copy: MT4 | MT5 */
export function platformShort(value) {
  return normalizePlatform(value) === 'mt4' ? 'MT4' : 'MT5';
}

export function normalizeRiskTrack(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'master' || v === 'ea' ? v : null;
}

export function riskTrackLabel(value) {
  const v = normalizeRiskTrack(value);
  if (v === 'master') return 'Master';
  if (v === 'ea') return 'EA / ATS';
  return 'Not set';
}

/** Active view denomination: cent only when drilling into a cent account. Portfolio stays USD. */
export function viewPnlDenomination(viewMode, activeAccount) {
  if (viewMode === 'account' && activeAccount) {
    return normalizePnlDenomination(activeAccount.pnl_denomination);
  }
  return 'usd';
}

/** Denomination for a single trade's account (portfolio rows may mix $ and ¢). */
export function tradePnlDenomination(trade, resolveTradeAccountFn) {
  const account = typeof resolveTradeAccountFn === 'function' ? resolveTradeAccountFn(trade) : null;
  return normalizePnlDenomination(account?.pnl_denomination);
}

export const ACCOUNT_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#dc2626'];

export function normalizeSlug(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function accountTypeLabel(type) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label || type;
}

export function pnlDenominationLabel(value) {
  const normalized = normalizePnlDenomination(value);
  return PNL_DENOMINATIONS.find((d) => d.value === normalized)?.label || 'Standard USD';
}

export function buildAccountLookups(tradingAccounts) {
  const byId = {};
  const bySlug = {};
  const byName = {};
  tradingAccounts.forEach((a) => {
    byId[a.id] = a;
    bySlug[a.slug] = a;
    byName[a.name.trim().toLowerCase()] = a;
  });
  return { byId, bySlug, byName };
}

export function resolveTradeAccount(trade, lookups) {
  if (!trade) return null;
  const { byId, bySlug, byName } = lookups;
  if (trade.account_id && byId[trade.account_id]) return byId[trade.account_id];
  if (!trade.account) return null;
  const slug = normalizeSlug(trade.account);
  return bySlug[slug] || byName[trade.account.trim().toLowerCase()] || null;
}

export function tradeMatchesAccount(trade, accountId, lookups) {
  if (!accountId) return true;
  if (trade.account_id === accountId) return true;
  const resolved = resolveTradeAccount(trade, lookups);
  if (resolved?.id === accountId) return true;
  const account = lookups.byId[accountId];
  if (!account || !trade.account) return false;
  return normalizeSlug(trade.account) === account.slug
    || trade.account.trim().toLowerCase() === account.name.trim().toLowerCase();
}

export function selectableTradingAccounts(tradingAccounts) {
  return tradingAccounts;
}
