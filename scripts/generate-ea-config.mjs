import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const eaDir = resolve(root, 'backend/ea');
const eaFile = resolve(eaDir, 'FinhubJournal_TradeSync.mq5');

function loadEnv() {
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
  return vars;
}

function resolveEndpoint(vars) {
  const apiUrl = vars.VITE_EA_API_URL?.replace(/\/$/, '') || vars.EA_API_URL?.replace(/\/$/, '');
  const vercelUrl = vars.VERCEL_URL ? `https://${vars.VERCEL_URL.replace(/^https?:\/\//, '')}` : '';
  const port = vars.EA_API_PORT || '8787';
  return apiUrl || (vercelUrl ? `${vercelUrl}/v1/ea/sync` : `http://localhost:${port}/v1/ea/sync`);
}

function patchEaUrl(endpoint) {
  const src = readFileSync(eaFile, 'utf8');
  const pattern = /const string EndpointURL\s*=\s*"[^"]*";/;
  if (!pattern.test(src)) {
    console.error('Could not find EndpointURL in FinhubJournal_TradeSync.mq5');
    process.exit(1);
  }
  const next = src.replace(pattern, `const string EndpointURL  = "${endpoint}";`);
  if (next !== src) writeFileSync(eaFile, next);
  console.log(`EA sync URL: ${endpoint}`);
}

function findMt5Paths() {
  const home = process.env.HOME || '';
  const wineData = resolve(home, 'Library/Application Support/net.metaquotes.wine.metatrader5');
  const mt5Root = resolve(wineData, 'drive_c/Program Files/MetaTrader 5');
  const wine64 = '/Applications/MetaTrader 5.app/Contents/SharedSupport/wine/bin/wine64';
  const terminal = resolve(mt5Root, 'terminal64.exe');
  const expertsDir = resolve(mt5Root, 'MQL5/Experts');

  if (!existsSync(wine64) || !existsSync(terminal)) {
    return null;
  }
  return { wineData, mt5Root, wine64, terminal, expertsDir };
}

function compileEa() {
  const mt5 = findMt5Paths();
  if (!mt5) {
    console.error('MetaTrader 5 not found. Install MT5 for Mac, then run: npm run ea:compile');
    process.exit(1);
  }

  mkdirSync(mt5.expertsDir, { recursive: true });
  const targetMq5 = resolve(mt5.expertsDir, 'FinhubJournal_TradeSync.mq5');
  copyFileSync(eaFile, targetMq5);

  const winPath = 'C:\\Program Files\\MetaTrader 5\\MQL5\\Experts\\FinhubJournal_TradeSync.mq5';
  const result = spawnSync(
    mt5.wine64,
    [mt5.terminal, `/compile:${winPath}`],
    {
      env: { ...process.env, WINEPREFIX: mt5.wineData },
      stdio: 'inherit',
      timeout: 120000,
    },
  );

  const builtEx5 = resolve(mt5.expertsDir, 'FinhubJournal_TradeSync.ex5');
  const repoEx5 = resolve(eaDir, 'FinhubJournal_TradeSync.ex5');
  const publicEx5 = resolve(root, 'public/FinhubJournal_TradeSync.ex5');

  if (!existsSync(builtEx5)) {
    console.error('Compile finished but .ex5 was not produced. Open MetaEditor and compile manually (F7).');
    process.exit(result.status ?? 1);
  }

  copyFileSync(builtEx5, repoEx5);
  mkdirSync(resolve(root, 'public'), { recursive: true });
  copyFileSync(builtEx5, publicEx5);
  console.log(`Compiled: ${repoEx5}`);
  console.log(`Download: ${publicEx5}`);
}

const vars = loadEnv();
const endpoint = resolveEndpoint(vars);
patchEaUrl(endpoint);

if (process.argv.includes('--compile')) {
  compileEa();
}
