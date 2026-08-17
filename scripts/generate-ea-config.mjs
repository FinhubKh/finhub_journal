import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, statSync } from 'fs';
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
  const pattern = /const string EndpointPrimary\s*=\s*"[^"]*";/;
  if (!pattern.test(src)) {
    console.error('Could not find EndpointPrimary in FinhubJournal_TradeSync.mq5');
    process.exit(1);
  }
  const next = src.replace(pattern, `const string EndpointPrimary  = "${endpoint}";`);
  if (next !== src) writeFileSync(eaFile, next);
  console.log(`EA primary sync URL: ${endpoint}`);
}

function findMt5Paths() {
  const home = process.env.HOME || '';
  const wineData = resolve(home, 'Library/Application Support/net.metaquotes.wine.metatrader5');
  const mt5Root = resolve(wineData, 'drive_c/Program Files/MetaTrader 5');
  const wine64 = '/Applications/MetaTrader 5.app/Contents/SharedSupport/wine/bin/wine64';
  const terminal = resolve(mt5Root, 'terminal64.exe');
  const metaeditor = resolve(mt5Root, 'MetaEditor64.exe');
  const expertsDir = resolve(mt5Root, 'MQL5/Experts');

  if (!existsSync(wine64) || !existsSync(metaeditor)) {
    return null;
  }
  return { wineData, mt5Root, wine64, terminal, metaeditor, expertsDir };
}

function compileEa() {
  const mt5 = findMt5Paths();
  if (!mt5) {
    console.error('MetaTrader 5 not found. Install MT5 for Mac, then run: npm run ea:compile');
    process.exit(1);
  }

  const zPath = `Z:${eaFile.replace(/\//g, '\\')}`;
  const beforeMtime = existsSync(resolve(eaDir, 'FinhubJournal_TradeSync.ex5'))
    ? statSync(resolve(eaDir, 'FinhubJournal_TradeSync.ex5')).mtimeMs
    : 0;

  const result = spawnSync(
    mt5.wine64,
    [mt5.metaeditor, `/compile:${zPath}`, '/log'],
    {
      env: { ...process.env, WINEPREFIX: mt5.wineData },
      stdio: 'inherit',
      timeout: 90000,
    },
  );

  const logPath = resolve(eaDir, 'FinhubJournal_TradeSync.log');
  if (existsSync(logPath)) {
    try {
      console.log(readFileSync(logPath, 'utf16le').replace(/\u0000/g, ''));
    } catch {
      console.log(readFileSync(logPath, 'utf8'));
    }
  }

  const builtEx5 = resolve(eaDir, 'FinhubJournal_TradeSync.ex5');
  const publicEx5 = resolve(root, 'public/FinhubJournal_TradeSync.ex5');
  const afterMtime = existsSync(builtEx5) ? statSync(builtEx5).mtimeMs : 0;

  if (!existsSync(builtEx5) || afterMtime <= beforeMtime) {
    console.error('Compile finished but a fresh .ex5 was not produced. Open MetaEditor and compile manually (F7).');
    process.exit(result.status ?? 1);
  }

  mkdirSync(resolve(root, 'public'), { recursive: true });
  copyFileSync(builtEx5, publicEx5);
  console.log(`Compiled: ${builtEx5}`);
  console.log(`Download: ${publicEx5}`);
}

const vars = loadEnv();
const endpoint = resolveEndpoint(vars);
if (process.argv.includes('--patch-url')) {
  patchEaUrl(endpoint);
} else {
  console.log(`EA URLs left as in source. Pass --patch-url to bake ${endpoint}`);
}

if (process.argv.includes('--compile')) {
  compileEa();
}
