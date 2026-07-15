#!/usr/bin/env node
/**
 * Seed 10 published sample accounts for the public leaderboard.
 * Usage: npm run seed:leaderboard
 *
 * Each trader is a SEPARATE auth user with exactly ONE trading account
 * (not 10 accounts under one login).
 *
 * Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 * Safe to re-run: deletes previous @seed.finhubkh.local users first.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SEED_DOMAIN = 'seed.finhubkh.local';
const SEED_PASSWORD = 'SeedDemo!168';

const TRADERS = [
  { slug: '01', name: 'Nova Edge', account: 'Nova Live', type: 'live', color: '#7c3aed', bias: 1.4 },
  { slug: '02', name: 'Kim Sokha', account: 'FTMO Challenge', type: 'prop', color: '#2563eb', bias: 1.15 },
  { slug: '03', name: 'Rithy Vann', account: 'IC Markets', type: 'live', color: '#059669', bias: 1.05 },
  { slug: '04', name: 'Sreypov Chan', account: 'Prop Phase 2', type: 'prop', color: '#db2777', bias: 0.95 },
  { slug: '05', name: 'Dara Meng', account: 'Demo Lab', type: 'demo', color: '#ea580c', bias: 0.7 },
  { slug: '06', name: 'Alya Lim', account: 'Pepperstone', type: 'live', color: '#0891b2', bias: 1.25 },
  { slug: '07', name: 'Vicheka Sok', account: 'FundedNext', type: 'prop', color: '#4f46e5', bias: 0.85 },
  { slug: '08', name: 'Pisey Hang', account: 'Cent Scalper', type: 'live', color: '#ca8a04', bias: 0.55 },
  { slug: '09', name: 'Rothana Chea', account: 'Swing Desk', type: 'live', color: '#0d9488', bias: 1.35 },
  { slug: '10', name: 'Mony Prak', account: 'Asia Session', type: 'demo', color: '#9333ea', bias: 0.4 },
];

const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'NAS100', 'US30'];
const SESSIONS = ['asian', 'london', 'ny'];
const MODELS = ['Breakout', 'Pullback', 'ORB', 'Scalp'];

const envPath = resolve(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.error('.env not found');
  process.exit(1);
}

const env = {};
readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

function emailFor(slug) {
  return `trader${slug}@${SEED_DOMAIN}`;
}

function shareTokenFor(slug) {
  return `seeddemo${slug}`.padEnd(32, '0');
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTrades(userId, accountId, bias, seed) {
  const rand = mulberry32(seed);
  const trades = [];
  const count = 12 + Math.floor(rand() * 10); // 12–21 trades
  const start = new Date();
  start.setDate(start.getDate() - count - 5);

  for (let i = 0; i < count; i += 1) {
    const winChance = Math.min(0.72, Math.max(0.38, 0.48 + (bias - 1) * 0.18));
    const roll = rand();
    let result = 'be';
    if (roll < winChance) result = 'win';
    else if (roll < winChance + (1 - winChance) * 0.9) result = 'loss';

    const base = 40 + rand() * 180;
    let pnl = 0;
    let rValue = 0;
    if (result === 'win') {
      pnl = +(base * bias * (0.7 + rand() * 0.9)).toFixed(2);
      rValue = +(0.8 + rand() * 2.2).toFixed(2);
    } else if (result === 'loss') {
      pnl = +(-(base * (0.55 + rand() * 0.7))).toFixed(2);
      rValue = +(-(0.6 + rand() * 1.4)).toFixed(2);
    }

    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const date = day.toISOString().slice(0, 10);
    const symbol = SYMBOLS[Math.floor(rand() * SYMBOLS.length)];
    const direction = rand() > 0.5 ? 'buy' : 'sell';

    trades.push({
      user_id: userId,
      account_id: accountId,
      date,
      result,
      r_value: rValue,
      pnl_usd: pnl,
      symbol,
      direction,
      session: SESSIONS[Math.floor(rand() * SESSIONS.length)],
      model: MODELS[Math.floor(rand() * MODELS.length)],
      source: 'manual',
      notes: 'Seeded demo trade',
      ticket: 900000 + seed * 100 + i,
    });
  }
  return trades;
}

async function listSeedUsers() {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
  if (!res.ok) throw new Error(`List users failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.users || []).filter((u) => (u.email || '').endsWith(`@${SEED_DOMAIN}`));
}

async function deleteUser(userId) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete user ${userId} failed: ${res.status} ${await res.text()}`);
  }
}

async function createUser(email, displayName) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });
  if (!res.ok) throw new Error(`Create ${email} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // Admin API may return the user at top-level or nested under `user`
  const userId = data?.id || data?.user?.id;
  if (!userId) throw new Error(`Create ${email} returned no user id: ${JSON.stringify(data)}`);
  return { id: userId, email: data.email || data.user?.email || email };
}

async function upsertProfile(userId, email, displayName) {
  const res = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: userId,
      email,
      display_name: displayName,
      role: 'user',
    }),
  });
  if (!res.ok) throw new Error(`Profile upsert failed: ${res.status} ${await res.text()}`);
}

async function insertAccount(row) {
  const res = await fetch(`${url}/rest/v1/trading_accounts`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Account insert failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function insertTrades(trades) {
  const res = await fetch(`${url}/rest/v1/trades`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(trades),
  });
  if (!res.ok) throw new Error(`Trades insert failed: ${res.status} ${await res.text()}`);
}

async function assertOneAccountPerUser(userIds) {
  const unique = new Set(userIds);
  if (unique.size !== userIds.length) {
    throw new Error(`Seed bug: expected ${userIds.length} different users, got ${unique.size}`);
  }
  const q = encodeURIComponent(`in.(${[...unique].join(',')})`);
  const res = await fetch(
    `${url}/rest/v1/trading_accounts?user_id=${q}&select=user_id,name`,
    { headers },
  );
  if (!res.ok) throw new Error(`Verify accounts failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  const counts = {};
  for (const row of rows) {
    counts[row.user_id] = (counts[row.user_id] || 0) + 1;
  }
  const multi = Object.entries(counts).filter(([, n]) => n > 1);
  if (multi.length) {
    throw new Error(`Seed bug: some users own multiple accounts: ${JSON.stringify(multi)}`);
  }
}

async function main() {
  console.log('Cleaning previous leaderboard seed users (one auth user per trader)…');
  const existing = await listSeedUsers();
  for (const u of existing) {
    await deleteUser(u.id);
    console.log(`  removed ${u.email}`);
  }

  console.log('Creating 10 SEPARATE users (1 trading account each)…');
  const createdUserIds = [];

  for (let i = 0; i < TRADERS.length; i += 1) {
    const t = TRADERS[i];
    const email = emailFor(t.slug);
    const user = await createUser(email, t.name);
    const userId = user.id;
    if (createdUserIds.includes(userId)) {
      throw new Error(`Duplicate user id for ${email}: ${userId}`);
    }
    createdUserIds.push(userId);
    await upsertProfile(userId, email, t.name);

    const account = await insertAccount({
      user_id: userId,
      name: t.account,
      slug: `seed-${t.slug}-${t.account.toLowerCase().replace(/\s+/g, '-')}`,
      account_type: t.type,
      broker: 'Demo Broker',
      starting_balance: 10000,
      color: t.color,
      is_default: true,
      connection_status: 'manual',
      pnl_denomination: 'usd',
      is_public: true,
      share_token: shareTokenFor(t.slug),
      published_at: new Date().toISOString(),
    });

    if (account.user_id !== userId) {
      throw new Error(`Account ${account.name} linked to wrong user (${account.user_id} != ${userId})`);
    }

    const trades = buildTrades(userId, account.id, t.bias, 1000 + i * 17);
    await insertTrades(trades);

    const pnl = trades.reduce((s, tr) => s + tr.pnl_usd, 0);
    console.log(
      `  [${i + 1}/10] ${t.name} <${email}> user=${userId.slice(0, 8)}… · ${t.account} · ${trades.length} trades · PnL ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
    );
  }

  await assertOneAccountPerUser(createdUserIds);

  console.log('\nOK — 10 different people, 1 published account each.');
  console.log(`Optional logins: trader01@${SEED_DOMAIN} … trader10@${SEED_DOMAIN} / ${SEED_PASSWORD}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
