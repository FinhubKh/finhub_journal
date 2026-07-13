#!/usr/bin/env node
/**
 * FinhubKH EA sync API — custom endpoint for MT4/5.
 * Supabase keys stay server-side; EA only sends x-sync-key + trades.
 *
 * Usage: npm run api:dev
 */
import { createServer } from 'http';
import { loadEnv } from './load-env.mjs';
import { handleEaSync } from './sync-handler.mjs';
import { fetchEconomicCalendar, fetchMarketNews } from './market-handler.mjs';
import { handleAiChecklistRequest } from './ai-checklist-handler.mjs';

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const sealionApiKey = (env.SEALION_API_KEY || '').trim();
const sealionModel = (env.SEALION_MODEL || '').trim() || undefined;
const port = Number(env.EA_API_PORT || 8787);

if (!supabaseUrl || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/market/economic-calendar') {
    try {
      const data = await fetchEconomicCalendar();
      sendJson(res, 200, data, { 'Cache-Control': 'public, max-age=300' });
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Failed to load economic calendar' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/market/news') {
    try {
      const data = await fetchMarketNews(url.searchParams.get('limit'));
      sendJson(res, 200, data, { 'Cache-Control': 'public, max-age=300' });
    } catch (err) {
      sendJson(res, 502, { error: err.message || 'Failed to load market news' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/ea/sync') {
    const body = await readBody(req);
    if (!body) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const result = await handleEaSync({
      syncKey: req.headers['x-sync-key'],
      trades: body.trades,
      accountMeta: body.account_meta,
      supabaseUrl,
      serviceKey,
    });
    sendJson(res, result.status, result.body);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/ai/checklist') {
    if (!anonKey) {
      sendJson(res, 500, { error: 'Supabase anon key is not configured' });
      return;
    }
    const body = await readBody(req);
    req.body = body || {};
    const result = await handleAiChecklistRequest(req, {
      supabaseUrl,
      anonKey,
      sealionApiKey,
      model: sealionModel,
    });
    sendJson(res, result.status, result.body);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`FinhubKH EA API listening on http://localhost:${port}`);
  console.log(`Sync endpoint: http://localhost:${port}/v1/ea/sync`);
});
