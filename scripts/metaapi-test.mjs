#!/usr/bin/env node
/**
 * Local MetaAPI smoke test — reads METAAPI_TOKEN or METAAPI from .env
 * Usage: npm run metaapi:test
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROVISIONING_API = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai';

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    const env = {};
    raw.split('\n').forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
    return env;
  } catch {
    return {};
  }
}

async function metaFetch(url, token) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'auth-token': token },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || text);
  return data;
}

const env = loadEnv();
const token = process.env.METAAPI_TOKEN || process.env.METAAPI || env.METAAPI_TOKEN || env.METAAPI;

if (!token) {
  console.error('Missing METAAPI_TOKEN in .env or environment');
  process.exit(1);
}

console.log('MetaAPI token found. Listing accounts...\n');

const accounts = await metaFetch(`${PROVISIONING_API}/users/current/accounts`, token);

if (!Array.isArray(accounts) || accounts.length === 0) {
  console.log('No accounts linked yet.');
  console.log('Add one at https://app.metaapi.cloud/accounts or use Settings > Connect MT account after deploying edge functions.');
  process.exit(0);
}

accounts.forEach((a) => {
  const id = a.id || a._id;
  console.log(`- ${a.name}`);
  console.log(`  id: ${id}`);
  console.log(`  login: ${a.login}  server: ${a.server}`);
  console.log(`  status: ${a.connectionStatus}  region: ${a.region || 'new-york'}`);
  console.log('');
});

const connected = accounts.find((a) => (a.connectionStatus || '').toUpperCase() === 'CONNECTED');
if (!connected) {
  console.log('No CONNECTED account yet. Wait a few minutes after adding in MetaAPI dashboard.');
  process.exit(0);
}

const id = connected.id || connected._id;
const region = connected.region || 'new-york';
const end = new Date();
const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
const base = `https://mt-client-api-v1.${region}.agiliumtrade.ai`;

console.log(`Fetching deals for ${connected.name} (last 90 days)...`);

const deals = await metaFetch(
  `${base}/users/current/accounts/${id}/history-deals/time/${start.toISOString()}/${end.toISOString()}?limit=10`,
  token,
);

const closing = (deals || []).filter((d) => d.entryType === 'DEAL_ENTRY_OUT');
console.log(`Sample closing deals: ${closing.length}`);
closing.slice(0, 3).forEach((d) => {
  console.log(`  ${d.symbol}  profit=${d.profit}  time=${d.time}`);
});

console.log('\nMetaAPI token works.');
