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

const apiUrl = vars.EA_API_URL?.replace(/\/$/, '');
const port = vars.EA_API_PORT || '8787';
const endpoint = apiUrl || `http://localhost:${port}/v1/ea/sync`;

const outPath = resolve(root, 'backend/ea/nXuu_TradeSync.config.mqh');
const out = `// Auto-generated from .env — run: npm run ea:config
#ifndef NXUU_TRADESYNC_CONFIG_MQH
#define NXUU_TRADESYNC_CONFIG_MQH
#define NXUU_API_URL "${endpoint}"
#endif
`;

writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
console.log(`EA sync URL: ${endpoint}`);
