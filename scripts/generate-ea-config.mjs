import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

if (!existsSync(envPath)) {
  console.error('.env not found. Copy .env.example to .env and set your keys.');
  process.exit(1);
}

const vars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  vars[key] = val;
}

const url = vars.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = vars.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const endpoint = `${url}/functions/v1/sync-trades`;
const outPath = resolve(root, 'backend/ea/nXuu_TradeSync.config.mqh');
const out = `// Auto-generated from .env — run: npm run ea:config
#ifndef NXUU_TRADESYNC_CONFIG_MQH
#define NXUU_TRADESYNC_CONFIG_MQH
#define NXUU_ENDPOINT_URL "${endpoint}"
#define NXUU_ANON_KEY "${key}"
#endif
`;

writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
