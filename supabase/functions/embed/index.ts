// ============================================================
// FinhubKH Journal — embed Edge Function
// Computes a free built-in embedding (gte-small, 384-dim) for
// journal text. Two modes:
//   - default: persist the embedding into journal_embeddings
//     (called by the trades/daily_pnl triggers via pg_net)
//   - mode: "query": return the embedding only, no persistence
//     (called by the Vercel backend to embed a chat question)
// Locked down with a shared secret header — not for public/browser use.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMBED_FUNCTION_SECRET = Deno.env.get('EMBED_FUNCTION_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-embed-secret',
};

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

interface EmbedRequest {
  mode?: 'query';
  source_type?: 'trade' | 'daily_note';
  source_id?: string;
  user_id?: string;
  account_id?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const secret = req.headers.get('x-embed-secret') || '';
  if (!EMBED_FUNCTION_SECRET || !timingSafeEqual(secret, EMBED_FUNCTION_SECRET)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  try {
    let body: EmbedRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
    }

    const content = String(body.content || '').trim().slice(0, 4000);
    if (!content) {
      return new Response(JSON.stringify({ error: 'content is required' }), { status: 400, headers: corsHeaders });
    }

    let embedding: number[];
    try {
      // @ts-expect-error Supabase.ai is injected by the Edge Runtime, not part of the TS lib.
      const session = new Supabase.ai.Session('gte-small');
      embedding = (await session.run(content, { mean_pool: true, normalize: true })) as number[];
    } catch (e) {
      return new Response(JSON.stringify({ error: `Embedding failed: ${String(e)}` }), { status: 500, headers: corsHeaders });
    }

    if (body.mode === 'query') {
      return new Response(JSON.stringify({ embedding }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!body.source_type || !body.source_id || !body.user_id) {
      return new Response(JSON.stringify({ error: 'source_type, source_id, user_id are required outside query mode' }), { status: 400, headers: corsHeaders });
    }

    // user_id/account_id/source_id are trusted verbatim once EMBED_FUNCTION_SECRET
    // matches — the only expected callers are the pg_net triggers and the
    // server-side Vercel backend, never an end-user's browser.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { error } = await supabase
      .from('journal_embeddings')
      .upsert(
        {
          source_type: body.source_type,
          source_id: body.source_id,
          user_id: body.user_id,
          account_id: body.account_id ?? null,
          content,
          embedding,
          metadata: body.metadata || {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_type,source_id' },
      );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
