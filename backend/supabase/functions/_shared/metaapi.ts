export const PROVISIONING_API = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

export function normalizeRegion(region?: string) {
  const value = (region || '').trim().toLowerCase();
  return value || '';
}

export function clientApiBase(region?: string) {
  const r = normalizeRegion(region) || 'london';
  return `https://mt-client-api-v1.${r}.agiliumtrade.ai`;
}

export async function metaApiFetch<T = unknown>(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'auth-token': token,
      ...(options.headers as Record<string, string> || {}),
    },
  });
  const text = await res.text();
  let data: T | { message?: string; error?: string } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { message?: string; error?: string }) || {};
    throw new Error(err.message || err.error || text || res.statusText);
  }
  if (res.status === 204 || !text) return null as T;
  return data as T;
}

export interface MetaApiAccount {
  _id?: string;
  id?: string;
  name?: string;
  login?: string;
  server?: string;
  platform?: string;
  region?: string;
  state?: string;
  connectionStatus?: string;
  connections?: Array<{ region?: string; application?: string }>;
}

export function metaApiAccountId(account: MetaApiAccount) {
  return account.id || account._id || '';
}

export async function createMetaApiAccount(
  token: string,
  payload: {
    name: string;
    login: string;
    password: string;
    server: string;
    platform: 'mt4' | 'mt5';
    region?: string;
  },
) {
  return metaApiFetch<MetaApiAccount>(`${PROVISIONING_API}/users/current/accounts`, token, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      login: payload.login,
      password: payload.password,
      server: payload.server,
      platform: payload.platform,
      type: 'cloud-g2',
      reliability: 'high',
      region: normalizeRegion(payload.region) || 'london',
      magic: 0,
    }),
  });
}

export async function updateMetaApiCredentials(
  token: string,
  metaapiAccountId: string,
  payload: { login: string; password: string },
) {
  return metaApiFetch(`${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}/credentials`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateMetaApiAccount(
  token: string,
  metaapiAccountId: string,
  payload: { name: string; server: string; password: string; login?: string },
) {
  const body: Record<string, string> = {
    name: payload.name,
    server: payload.server,
    password: payload.password,
  };
  if (payload.login) body.login = payload.login;
  return metaApiFetch(`${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function redeployMetaApiAccount(token: string, metaapiAccountId: string) {
  return metaApiFetch(`${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}/redeploy`, token, {
    method: 'POST',
  });
}

export async function ensureMetaApiAccountReady(
  token: string,
  metaapiAccountId: string,
  payload: { name: string; login: string; password: string; server: string },
  options: { updateCredentials?: boolean } = {},
) {
  const existing = await getMetaApiAccount(token, metaapiAccountId);
  const state = (existing.state || '').toUpperCase();
  const connected = (existing.connectionStatus || '').toUpperCase() === 'CONNECTED';

  if (state === 'DRAFT') {
    await updateMetaApiCredentials(token, metaapiAccountId, {
      login: payload.login,
      password: payload.password,
    });
    return waitForMetaApiConnection(token, metaapiAccountId, 120000);
  }

  const loginChanged = String(existing.login || '') !== payload.login;
  const serverChanged = (existing.server || '') !== payload.server;
  const shouldUpdate = Boolean(options.updateCredentials) || !connected || loginChanged || serverChanged;

  if (shouldUpdate) {
    await updateMetaApiAccount(token, metaapiAccountId, {
      name: payload.name,
      server: payload.server,
      password: payload.password,
      login: payload.login,
    });
    try {
      await redeployMetaApiAccount(token, metaapiAccountId);
    } catch {
      // redeploy may already be in progress
    }
    return waitForMetaApiConnection(token, metaapiAccountId, 120000);
  }

  if (!connected) {
    return waitForMetaApiConnection(token, metaapiAccountId, 120000);
  }

  return existing;
}

export async function getMetaApiAccount(token: string, metaapiAccountId: string) {
  return metaApiFetch<MetaApiAccount>(
    `${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`,
    token,
  );
}

export async function deleteMetaApiAccount(token: string, metaapiAccountId: string) {
  return metaApiFetch(`${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`, token, {
    method: 'DELETE',
  });
}

export async function waitForMetaApiConnection(token: string, metaapiAccountId: string, maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const account = await getMetaApiAccount(token, metaapiAccountId);
    const status = (account.connectionStatus || '').toUpperCase();
    if (status === 'CONNECTED') return account;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('MetaAPI account did not connect in time. Try again in a few minutes.');
}

export function accountRegion(account: MetaApiAccount, fallback?: string) {
  const fromConnections = account.connections?.find((c) => c.region)?.region;
  return normalizeRegion(account.region)
    || normalizeRegion(fromConnections)
    || normalizeRegion(fallback)
    || 'london';
}

function isRetryableMetaApiError(message: string) {
  const lower = message.toLowerCase();
  return lower.includes('region')
    || lower.includes('not connected to broker')
    || lower.includes('not connected yet');
}

export interface MetaApiDeal {
  id: string;
  positionId?: string;
  symbol?: string;
  type?: string;
  entryType?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  volume?: number;
  price?: number;
  time?: string;
}

async function fetchDealsPage(
  token: string,
  region: string,
  metaapiAccountId: string,
  startTime: string,
  endTime: string,
) {
  const base = clientApiBase(region);
  const deals: MetaApiDeal[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${base}/users/current/accounts/${metaapiAccountId}/history-deals/time/${startTime}/${endTime}?offset=${offset}&limit=${limit}`;
    const batch = await metaApiFetch<MetaApiDeal[]>(url, token);
    if (!Array.isArray(batch) || batch.length === 0) break;
    deals.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return deals;
}

export async function fetchDealsForAccount(
  token: string,
  metaapiAccountId: string,
  startTime: string,
  endTime: string,
  hintRegion?: string,
) {
  let account = await getMetaApiAccount(token, metaapiAccountId);
  if ((account.connectionStatus || '').toUpperCase() !== 'CONNECTED') {
    account = await waitForMetaApiConnection(token, metaapiAccountId, 120000);
  }
  let region = accountRegion(account, hintRegion);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return {
        deals: await fetchDealsPage(token, region, metaapiAccountId, startTime, endTime),
        region,
        account,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isRetryableMetaApiError(lastError.message) || attempt === 5) break;
      await new Promise((r) => setTimeout(r, 5000));
      account = await getMetaApiAccount(token, metaapiAccountId);
      region = accountRegion(account, hintRegion);
    }
  }

  const fallbackRegions = ['london', 'new-york'].filter((r) => r !== region);
  for (const fallback of fallbackRegions) {
    try {
      return {
        deals: await fetchDealsPage(token, fallback, metaapiAccountId, startTime, endTime),
        region: fallback,
        account,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('Could not fetch deals from MetaAPI');
}

export async function fetchDealsByTimeRange(
  token: string,
  region: string,
  metaapiAccountId: string,
  startTime: string,
  endTime: string,
) {
  return fetchDealsPage(token, region, metaapiAccountId, startTime, endTime);
}

export function mapClosingDealsToTrades(
  deals: MetaApiDeal[],
  userId: string,
  accountId: string,
  accountName: string,
) {
  return deals
    .filter((d) => d.entryType === 'DEAL_ENTRY_OUT' && d.symbol)
    .map((deal) => {
      const pnl = Number(deal.profit || 0) + Number(deal.commission || 0) + Number(deal.swap || 0);
      const ticket = parseInt(deal.positionId || deal.id, 10);
      const isBuy = (deal.type || '').includes('BUY');
      return {
        user_id: userId,
        source: 'metaapi',
        ticket,
        symbol: deal.symbol,
        direction: isBuy ? 'buy' : 'sell',
        exit_price: deal.price ?? null,
        lot_size: deal.volume ?? null,
        pnl_usd: pnl,
        r_value: 0,
        result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
        close_time: deal.time,
        open_time: deal.time,
        date: (deal.time || new Date().toISOString()).slice(0, 10),
        account: accountName,
        account_id: accountId,
      };
    })
    .filter((row) => Number.isFinite(row.ticket));
}
