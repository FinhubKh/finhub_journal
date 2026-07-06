#!/usr/bin/env node
/**
 * Deploy Supabase edge functions (EA sync only).
 * Usage: npm run functions:deploy
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const envPath = resolve(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const env = {};
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  return env;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: root });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const env = loadEnv();
const projectRef = env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('Could not read project ref from VITE_SUPABASE_URL in .env');
  process.exit(1);
}

console.log(`Deploying to project: ${projectRef}\n`);

const functions = ['sync-trades'];

for (const fn of functions) {
  console.log(`Deploying ${fn}...`);
  run('supabase', ['functions', 'deploy', fn, '--project-ref', projectRef]);
}

console.log('\nAll functions deployed.');
