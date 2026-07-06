#!/usr/bin/env node
/**
 * Create or promote the platform admin user.
 * Usage: npm run seed:admin
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ADMIN_EMAIL = 'admin168@gmail.com';
const ADMIN_PASSWORD = 'admin@168';
const ADMIN_DISPLAY_NAME = 'Admin';

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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: adminHeaders,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List users failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const users = data.users || [];
  return users.find((u) => u.email?.trim().toLowerCase() === normalized) || null;
}

async function createUser(email, password) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: ADMIN_DISPLAY_NAME },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create user failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function updatePassword(userId, password) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update password failed: ${res.status} ${text}`);
  }
}

async function upsertAdminProfile(userId, email) {
  await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });

  const postRes = await fetch(`${url}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...adminHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({
      id: userId,
      email,
      display_name: ADMIN_DISPLAY_NAME,
      role: 'admin',
    }),
  });
  if (!postRes.ok) {
    const text = await postRes.text();
    throw new Error(`Upsert profile failed: ${postRes.status} ${text}`);
  }
}

console.log(`Seeding admin: ${ADMIN_EMAIL}`);

let user = await findUserByEmail(ADMIN_EMAIL);

if (!user) {
  console.log('Creating auth user...');
  user = await createUser(ADMIN_EMAIL, ADMIN_PASSWORD);
} else {
  console.log(`User exists (${user.id}), resetting password...`);
  await updatePassword(user.id, ADMIN_PASSWORD);
}

console.log('Promoting profile to admin...');
await upsertAdminProfile(user.id, ADMIN_EMAIL);

console.log('\nAdmin ready.');
console.log(`  Email:    ${ADMIN_EMAIL}`);
console.log(`  Password: ${ADMIN_PASSWORD}`);
console.log(`  Login:    /login`);
console.log(`  Admin:    /admin`);
