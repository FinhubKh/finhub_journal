// ============================================================
// nXuu — sync-trades Edge Function
// Receives full trade history from the MT4/5 EA, authenticates
// via per-account sync key, upserts trades keyed by (user_id, ticket).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type, x-sync-key',
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface IncomingTrade {
  ticket:       number;
  symbol:       string;
  direction:    'buy' | 'sell';
  entry_price:  number;
  exit_price:   number;
  lot_size:     number;
  pnl_usd:      number;
  pnl_raw?:     number;
  r_value?:     number;
  open_time:    string;
  close_time:   string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const syncKey = req.headers.get('x-sync-key');
    if (!syncKey) {
      return new Response(JSON.stringify({ error: 'Missing x-sync-key header' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const trades: IncomingTrade[] = body.trades || [];
    if (!Array.isArray(trades) || trades.length === 0) {
      return new Response(JSON.stringify({ error: 'No trades provided' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const keyHash = await sha256Hex(syncKey);
    const { data: keyRow, error: keyErr } = await supabase
      .from('sync_keys')
      .select('user_id, trading_account_id')
      .eq('key_hash', keyHash)
      .single();

    if (keyErr || !keyRow?.user_id || !keyRow?.trading_account_id) {
      return new Response(JSON.stringify({ error: 'Invalid sync key' }), { status: 401, headers: corsHeaders });
    }

    const userId = keyRow.user_id;
    const tradingAccountId = keyRow.trading_account_id;

    const { data: matchedAccount } = await supabase
      .from('trading_accounts')
      .select('id, name, pnl_denomination')
      .eq('id', tradingAccountId)
      .eq('user_id', userId)
      .single();

    if (!matchedAccount) {
      return new Response(JSON.stringify({ error: 'Sync key is not linked to a trading account' }), { status: 401, headers: corsHeaders });
    }

    function resolvePnlUsd(t: IncomingTrade): number {
      const raw = t.pnl_raw != null ? Number(t.pnl_raw) : null;
      const fallback = Number(t.pnl_usd) || 0;
      const denom = matchedAccount.pnl_denomination === 'cent' ? 'cent' : 'usd';

      if (raw != null) {
        return denom === 'cent' ? raw / 100 : raw;
      }
      return fallback;
    }

    const rows = trades.map(t => {
      const pnl = resolvePnlUsd(t);
      return {
        user_id:      userId,
        source:       'api',
        ticket:       t.ticket,
        symbol:       t.symbol,
        direction:    t.direction,
        entry_price:  t.entry_price,
        exit_price:   t.exit_price,
        lot_size:     t.lot_size,
        pnl_usd:      pnl,
        r_value:      Number(t.r_value) || 0,
        result:       pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be',
        open_time:    t.open_time,
        close_time:   t.close_time,
        date:         (t.close_time || t.open_time || new Date().toISOString()).slice(0, 10),
        account:      matchedAccount.name,
        account_id:   matchedAccount.id,
      };
    });

    const { data, error } = await supabase
      .from('trades')
      .upsert(rows, { onConflict: 'user_id,ticket', ignoreDuplicates: false })
      .select('id');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      received: trades.length,
      inserted: data?.length || 0,
      account: matchedAccount.name,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
