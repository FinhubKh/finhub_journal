import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SEED_DOMAIN = 'seed.finhubkh.local';

const envPath = resolve(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.error('.env not found');
  process.exit(1);
}

const env = {};
readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const m = trimmed.match(/^([^=]+)=(.*)$/);
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

async function main() {
  console.log(`Cleaning all seed traders ending with @${SEED_DOMAIN}...`);
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const seedUsers = (data.users || []).filter((u) => (u.email || '').endsWith(`@${SEED_DOMAIN}`));

  console.log(`Found ${seedUsers.length} seed users to delete.`);
  for (const u of seedUsers) {
    const delRes = await fetch(`${url}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log(`  Deleted ${u.email} (${delRes.status})`);
  }
  console.log('Seed leaderboard data successfully cleaned from Supabase database.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
