import { deleteMetaApiAccount } from '../_shared/metaapi.ts';
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

    const { tradingAccountId, deleteRecord = true } = await req.json();
    if (!tradingAccountId) {
      return jsonResponse({ error: 'tradingAccountId is required' }, 400);
    }

    const supabase = serviceClient();
    const { data: account, error: accErr } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('id', tradingAccountId)
      .eq('user_id', user.id)
      .single();

    if (accErr || !account) {
      return jsonResponse({ error: 'Trading account not found' }, 404);
    }

    if (account.metaapi_account_id) {
      try {
        await deleteMetaApiAccount(metaapiToken, account.metaapi_account_id);
      } catch {
        // MetaAPI account may already be removed
      }
    }

    if (deleteRecord) {
      const { error } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', tradingAccountId);
      if (error) return jsonResponse({ error: error.message }, 500);
    } else {
      await supabase
        .from('trading_accounts')
        .update({
          metaapi_account_id: null,
          metaapi_server: null,
          mt_login: null,
          metaapi_platform: null,
          metaapi_region: null,
          connection_status: 'disconnected',
          sync_error: null,
        })
        .eq('id', tradingAccountId);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
