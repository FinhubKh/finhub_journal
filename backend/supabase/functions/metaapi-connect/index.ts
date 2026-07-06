import {
  createMetaApiAccount,
  fetchDealsForAccount,
  getMetaApiAccount,
  mapClosingDealsToTrades,
  metaApiAccountId,
  accountRegion,
  ensureMetaApiAccountReady,
  waitForMetaApiConnection,
} from '../_shared/metaapi.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/auth.ts';

const COLORS = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#db2777', '#0891b2', '#4f46e5', '#dc2626'];

function normalizeSlug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function syncAccountTrades(
  supabase: ReturnType<typeof serviceClient>,
  metaapiToken: string,
  userId: string,
  account: Record<string, unknown>,
) {
  const metaId = account.metaapi_account_id as string;

  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  const { deals, region, account: metaAccount } = await fetchDealsForAccount(
    metaapiToken,
    metaId,
    start.toISOString(),
    end.toISOString(),
    account.metaapi_region as string,
  );

  const rows = mapClosingDealsToTrades(
    deals,
    userId,
    account.id as string,
    account.name as string,
  );

  let inserted = 0;
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from('trades')
      .upsert(rows, { onConflict: 'user_id,ticket', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(error.message);
    inserted = data?.length || 0;
  }

  await supabase
    .from('trading_accounts')
    .update({
      connection_status: 'connected',
      last_synced_at: new Date().toISOString(),
      sync_error: null,
      metaapi_region: region,
    })
    .eq('id', account.id);

  return { deals: deals.length, closingDeals: rows.length, inserted, skipped: rows.length - inserted };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let tradingAccountId: string | undefined;
  const supabase = serviceClient();

  try {
    const user = await requireUser(req);
    const metaapiToken = Deno.env.get('METAAPI_TOKEN');
    if (!metaapiToken) {
      return jsonResponse({ error: 'METAAPI_TOKEN is not configured on the server' }, 500);
    }

    const body = await req.json();
    const {
      server,
      login,
      password,
      platform = 'mt5',
      name,
      accountType = 'live',
      broker,
      startingBalance,
      sync = true,
      updateCredentials = false,
    } = body;

    tradingAccountId = body.tradingAccountId;

    if (!server?.trim() || !login?.trim() || !password) {
      return jsonResponse({ error: 'server, login, and password are required' }, 400);
    }

    let account: Record<string, unknown> | null = null;

    if (tradingAccountId) {
      const { data, error: accErr } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('id', tradingAccountId)
        .eq('user_id', user.id)
        .single();
      if (accErr || !data) return jsonResponse({ error: 'Trading account not found' }, 404);
      account = data;
    } else {
      const accountName = name?.trim();
      if (!accountName) {
        return jsonResponse({ error: 'name is required when adding a new account' }, 400);
      }
      const slug = normalizeSlug(accountName);
      if (!slug) return jsonResponse({ error: 'Invalid account name' }, 400);

      const { data: existing } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        account = existing;
        tradingAccountId = existing.id as string;
      } else {
        const { count } = await supabase
          .from('trading_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const { data: created, error: createErr } = await supabase
          .from('trading_accounts')
          .insert({
            user_id: user.id,
            name: accountName,
            slug,
            account_type: accountType,
            broker: broker?.trim() || null,
            starting_balance: startingBalance ? Number(startingBalance) : null,
            color: COLORS[(count || 0) % COLORS.length],
            is_default: (count || 0) === 0,
            connection_status: 'connecting',
            metaapi_server: server.trim(),
            mt_login: String(login).trim(),
            metaapi_platform: platform,
          })
          .select()
          .single();

        if (createErr || !created) {
          return jsonResponse({ error: createErr?.message || 'Could not create trading account' }, 500);
        }
        account = created;
        tradingAccountId = created.id as string;
      }
    }

    await supabase
      .from('trading_accounts')
      .update({
        name: name?.trim() || account.name,
        account_type: accountType,
        broker: broker?.trim() || null,
        ...(startingBalance ? { starting_balance: Number(startingBalance) } : {}),
        connection_status: 'connecting',
        sync_error: null,
        metaapi_server: server.trim(),
        mt_login: String(login).trim(),
        metaapi_platform: platform,
      })
      .eq('id', tradingAccountId);

    const loginStr = String(login).trim();
    let metaapiAccount;

    if (account.metaapi_account_id) {
      metaapiAccount = await ensureMetaApiAccountReady(
        metaapiToken,
        account.metaapi_account_id as string,
        {
          name: `FinhubKH - ${account.name}`,
          login: loginStr,
          password,
          server: server.trim(),
        },
        { updateCredentials: Boolean(updateCredentials) },
      );
    } else {
      metaapiAccount = await createMetaApiAccount(metaapiToken, {
        name: `FinhubKH - ${account.name}`,
        login: loginStr,
        password,
        server: server.trim(),
        platform: platform === 'mt4' ? 'mt4' : 'mt5',
        region: 'london',
      });
      const newId = metaApiAccountId(metaapiAccount);
      metaapiAccount = await waitForMetaApiConnection(metaapiToken, newId, 120000);
    }

    const metaId = metaApiAccountId(metaapiAccount);
    metaapiAccount = await getMetaApiAccount(metaapiToken, metaId);

    const { data: updated } = await supabase
      .from('trading_accounts')
      .update({
        metaapi_account_id: metaId,
        metaapi_region: accountRegion(metaapiAccount),
        connection_status: 'connected',
        sync_error: null,
      })
      .eq('id', tradingAccountId)
      .select()
      .single();

    let syncResult = null;
    if (sync && updated) {
      syncResult = await syncAccountTrades(supabase, metaapiToken, user.id, updated);
    }

    return jsonResponse({
      ok: true,
      tradingAccountId,
      metaapiAccountId: metaId,
      connectionStatus: metaapiAccount.connectionStatus,
      region: metaapiAccount.region || 'new-york',
      sync: syncResult,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : String(e);
    if (tradingAccountId) {
      await supabase
        .from('trading_accounts')
        .update({ connection_status: 'error', sync_error: message })
        .eq('id', tradingAccountId);
    }
    return jsonResponse({ error: message }, 500);
  }
});
