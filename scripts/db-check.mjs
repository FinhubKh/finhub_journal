#!/usr/bin/env node
/**
 * Verify Supabase connection and that init.sql was applied.
 * Usage: npm run db:check
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.error('.env not found');
  process.exit(1);
}

const env = {};
readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

let role = 'unknown';
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  role = payload.role;
} catch {
  // ignore
}

if (role === 'service_role') {
  console.error('ERROR: VITE_SUPABASE_ANON_KEY is a service_role key.');
  console.error('Use the anon public key from Supabase → Settings → API → anon public');
  process.exit(1);
}

const tables = ['profiles', 'trades', 'checklist_steps', 'entry_models', 'trading_accounts', 'sync_keys', 'daily_pnl'];

console.log(`Project: ${url}`);
console.log(`Key role: ${role}\n`);

for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (res.status === 404 || res.status === 406) {
    console.log(`  ${table}: MISSING — run backend/init.sql in SQL Editor`);
  } else if (!res.ok) {
    const text = await res.text();
    console.log(`  ${table}: error ${res.status} — ${text.slice(0, 120)}`);
  } else {
    console.log(`  ${table}: ok`);
  }
}

const rpc = await fetch(`${url}/rest/v1/rpc/get_public_leaderboard`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_limit: 5, p_min_trades: 1 }),
});

if (rpc.ok) {
  console.log('  get_public_leaderboard(): ok');
} else {
  console.log(`  get_public_leaderboard(): missing or error (${rpc.status})`);
}

const adminRpc = await fetch(`${url}/rest/v1/rpc/admin_platform_stats`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: '{}',
});
if (adminRpc.status === 404) {
  console.log('  admin_platform_stats(): missing — run backend/schema_profiles_admin.sql');
} else if (!adminRpc.ok) {
  console.log(`  admin_platform_stats(): ok (requires admin login to call)`);
} else {
  console.log('  admin_platform_stats(): ok');
}

console.log('\nDone. Sign up in the app after tables show ok.');
