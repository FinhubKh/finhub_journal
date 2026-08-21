#!/usr/bin/env node
/**
 * One-time backfill: embed notes already in trades/daily_pnl that predate
 * the sync triggers. Safe to re-run — upserts on (source_type, source_id).
 * Usage: npm run embeddings:backfill
 */
import { loadEnv } from '../backend/api/load-env.mjs';

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const embedSecret = (env.EMBED_FUNCTION_SECRET || '').trim();

if (!supabaseUrl || !serviceKey || !embedSecret) {
  console.error('Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBED_FUNCTION_SECRET in .env');
  process.exit(1);
}

async function fetchRows(table, columns) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?select=${columns}&notes=not.is.null&limit=5000`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) throw new Error(`Failed to load ${table}: ${await res.text()}`);
  const rows = await res.json();
  if (rows.length === 5000) {
    console.warn(`  WARNING: ${table} returned exactly 5000 rows (the query limit) — there may be more unembedded notes than this run covers. This script does not paginate; if this warning appears, some notes were not backfilled.`);
  }
  return rows.filter((r) => String(r.notes || '').trim().length > 0);
}

async function embedAndSave(payload) {
  let res;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-embed-secret': embedSecret },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`  FAILED ${payload.source_type} ${payload.source_id}: ${err?.message || err}`);
    return false;
  }
  if (!res.ok) {
    console.error(`  FAILED ${payload.source_type} ${payload.source_id}: ${await res.text()}`);
    return false;
  }
  return true;
}

async function main() {
  const trades = await fetchRows('trades', 'id,user_id,account_id,date,symbol,direction,session,result,r_value,pnl_usd,notes');
  console.log(`Backfilling ${trades.length} trades with notes...`);
  let ok = 0;
  for (const [i, t] of trades.entries()) {
    const done = await embedAndSave({
      source_type: 'trade',
      source_id: t.id,
      user_id: t.user_id,
      account_id: t.account_id,
      content: t.notes.trim(),
      metadata: { date: t.date, symbol: t.symbol, direction: t.direction, session: t.session, result: t.result, r_value: t.r_value, pnl_usd: t.pnl_usd },
    });
    if (done) ok += 1;
    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${trades.length} trades processed`);
  }
  console.log(`  trades: ${ok}/${trades.length} embedded`);

  const dailyNotes = await fetchRows('daily_pnl', 'id,user_id,date,pnl_usd,trade_count,notes');
  console.log(`Backfilling ${dailyNotes.length} daily notes...`);
  let okDaily = 0;
  for (const [i, d] of dailyNotes.entries()) {
    const done = await embedAndSave({
      source_type: 'daily_note',
      source_id: d.id,
      user_id: d.user_id,
      account_id: null,
      content: d.notes.trim(),
      metadata: { date: d.date, pnl_usd: d.pnl_usd, trade_count: d.trade_count },
    });
    if (done) okDaily += 1;
    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${dailyNotes.length} daily notes processed`);
  }
  console.log(`  daily_pnl: ${okDaily}/${dailyNotes.length} embedded`);

  if (ok < trades.length || okDaily < dailyNotes.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
