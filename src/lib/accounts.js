export const ACCOUNT_TYPES = [
  { value: 'live', label: 'Live' },
  { value: 'prop', label: 'Prop / Challenge' },
  { value: 'demo', label: 'Demo' },
];

export const PNL_DENOMINATIONS = [
  { value: 'auto', label: 'Auto-detect (EA)' },
  { value: 'usd', label: 'Standard USD' },
  { value: 'cent', label: 'Cent account' },
];

export const ACCOUNT_COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#dc2626'];

export function normalizeSlug(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function accountTypeLabel(type) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label || type;
}

export function pnlDenominationLabel(value) {
  return PNL_DENOMINATIONS.find((d) => d.value === value)?.label || value || 'Auto-detect';
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

export function filterTradesForView(allTrades, tradingAccounts, viewMode, activeAccountId) {
  const lookups = buildAccountLookups(tradingAccounts);

  if (viewMode === 'account' && activeAccountId) {
    return allTrades.filter((t) => tradeMatchesAccount(t, activeAccountId, lookups));
  }

  return allTrades;
}

export function groupTradesByAccount(allTrades, tradingAccounts) {
  const lookups = buildAccountLookups(tradingAccounts);
  const groups = new Map();

  tradingAccounts.forEach((a) => {
    groups.set(a.id, { account: a, trades: [] });
  });

  const untagged = [];
  allTrades.forEach((t) => {
    const acc = resolveTradeAccount(t, lookups);
    if (acc && groups.has(acc.id)) {
      groups.get(acc.id).trades.push(t);
    } else {
      untagged.push(t);
    }
  });

  const rows = [...groups.values()].filter((g) => g.trades.length > 0);
  if (untagged.length > 0) {
    rows.push({
      account: { id: '__untagged', name: 'Untagged', account_type: 'live', color: '#a1a1aa' },
      trades: untagged,
    });
  }
  return rows.sort((a, b) => {
    const pnlA = a.trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    const pnlB = b.trades.reduce((s, t) => s + (t.pnl_usd || 0), 0);
    return pnlB - pnlA;
  });
}

export function legacyAccountNames(tradingAccounts, allTrades) {
  const names = new Set(tradingAccounts.map((a) => a.name));
  allTrades.forEach((t) => {
    if (t.account) names.add(t.account);
  });
  return [...names].sort();
}

export function selectableTradingAccounts(tradingAccounts) {
  return tradingAccounts;
}

/** @deprecated use selectableTradingAccounts */
export function connectedTradingAccounts(tradingAccounts) {
  return selectableTradingAccounts(tradingAccounts);
}
