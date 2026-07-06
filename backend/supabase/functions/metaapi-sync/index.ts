import {
  fetchDealsForAccount,
  getMetaApiAccount,
  mapClosingDealsToTrades,
  waitForMetaApiConnection,
} from '../_shared/metaapi.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const user = await requireUser(req);
    const metaapiToken = Deno.env.get('METAAPI_TOKEN');
    if (!metaapiToken) {
      return jsonResponse({ error: 'METAAPI_TOKEN is not configured on the server' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { tradingAccountId } = body;

    const supabase = serviceClient();
    let query = supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .not('metaapi_account_id', 'is', null);

    if (tradingAccountId) {
      query = query.eq('id', tradingAccountId);
    }

    const { data: accounts, error: accErr } = await query;
    if (accErr) return jsonResponse({ error: accErr.message }, 500);
    if (!accounts?.length) {
      return jsonResponse({ error: 'No MetaAPI-connected trading accounts found' }, 404);
    }

    const results = [];

    for (const account of accounts) {
      try {
        const metaId = account.metaapi_account_id;

        let metaAccount = await getMetaApiAccount(metaapiToken, metaId);
        if ((metaAccount.connectionStatus || '').toUpperCase() !== 'CONNECTED') {
          metaAccount = await waitForMetaApiConnection(metaapiToken, metaId, 120000);
        }
        const end = new Date();
        const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        const { deals, region } = await fetchDealsForAccount(
          metaapiToken,
          metaId,
          start.toISOString(),
          end.toISOString(),
          account.metaapi_region,
        );

        const rows = mapClosingDealsToTrades(deals, user.id, account.id, account.name);

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

        results.push({
          tradingAccountId: account.id,
          name: account.name,
          deals: deals.length,
          closingDeals: rows.length,
          inserted,
          skipped: rows.length - inserted,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabase
          .from('trading_accounts')
          .update({ connection_status: 'error', sync_error: message })
          .eq('id', account.id);
        results.push({
          tradingAccountId: account.id,
          name: account.name,
          error: message,
        });
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
