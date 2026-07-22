/**
 * AI performance coach via SEA-LION.
 * Loads user trades with their JWT (RLS), builds a stats summary, then coaches.
 */

import { verifySupabaseUser, readJsonBody, DEFAULT_MODEL } from './ai-checklist-handler.mjs';
import { buildPerformanceSummary } from './performance-stats.mjs';

const SEA_LION_BASE = 'https://api.sea-lion.ai/v1';
const MAX_RANGE_DAYS = 180;
const MAX_CHAT_MSG = 800;
const MAX_CHAT_HISTORY = 8;
const TRADE_SELECT = [
  'id', 'date', 'result', 'r_value', 'pnl_usd', 'model', 'session',
  'account', 'account_id', 'symbol', 'direction', 'ticket',
].join(',');

const rateBuckets = new Map();

const INSIGHTS_SYSTEM = `You are a trading performance coach for FinHubKH Journal.
Return ONLY valid JSON:
{"insights":[{"title":"Short title","detail":"1-2 sentences","tone":"positive|warning|neutral"}]}

Rules:
- 3 to 6 insights
- Base every insight on the provided stats summary only
- Be direct and practical; no fluff, no markdown, no code fences
- Do not invent trades or numbers not in the summary
- Write in the requested language (en or km)`;

const REPORT_SYSTEM = `You are a trading performance coach for FinHubKH Journal.
Return ONLY valid JSON:
{"title":"Short report title","summary":"...","working":["..."],"hurting":["..."],"habits":["..."],"action_plan":["..."],"focus_next":"One line focus"}

Rules:
- Base everything on the provided stats summary only
- 2 to 5 items in working, hurting, habits, action_plan
- Action plan items must be concrete next steps
- No markdown, no code fences
- Write in the requested language (en or km)`;

const CHAT_SYSTEM = `You are a trading performance coach for FinHubKH Journal.
Answer using ONLY the provided stats summary for the selected account and date range.
If the answer is not in the data, say you do not have that information.
No trade placement or broker advice. Coaching only.
Reply in the requested language (en or km), or match the user's message language if clearer.
Return ONLY valid JSON: {"reply":"your answer"}`;

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty AI response');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('AI did not return valid JSON');
  }
}

function normalizeLanguage(value) {
  const v = String(value || 'en').trim().toLowerCase();
  return v === 'km' || v === 'khmer' ? 'km' : 'en';
}

function parseDateOnly(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86400000);
}

function checkRateLimit(userId, kind, limit = 20, windowMs = 60 * 60 * 1000) {
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    return false;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      throw new Error('Invalid JSON body');
    }
  }
  return readJsonBody(req);
}

async function sealionChat({ apiKey, model, system, user, temperature = 0.35 }) {
  if (!apiKey) {
    return { status: 500, body: { error: 'SEA-LION API key is not configured' } };
  }

  const res = await fetch(`${SEA_LION_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    let message = `SEA-LION request failed (${res.status})`;
    try {
      const errBody = JSON.parse(rawText);
      message = errBody?.error?.message || errBody?.message || message;
    } catch {
      // keep default
    }
    return { status: 502, body: { error: message } };
  }

  let content = '';
  try {
    const data = JSON.parse(rawText);
    content = data?.choices?.[0]?.message?.content || '';
  } catch {
    content = rawText;
  }
  return { status: 200, content };
}

async function fetchAccountAndTrades({
  supabaseUrl,
  anonKey,
  accessToken,
  userId,
  accountId,
  fromDate,
  toDate,
}) {
  const accountRes = await fetch(
    `${supabaseUrl}/rest/v1/trading_accounts?select=id,name&id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!accountRes.ok) {
    const text = await accountRes.text();
    return { error: { status: 500, body: { error: text || 'Failed to load account' } } };
  }
  const accounts = await accountRes.json();
  const account = accounts?.[0];
  if (!account) {
    return { error: { status: 404, body: { error: 'Trading account not found' } } };
  }

  const tradesRes = await fetch(
    `${supabaseUrl}/rest/v1/trades?select=${TRADE_SELECT}`
      + `&user_id=eq.${encodeURIComponent(userId)}`
      + `&account_id=eq.${encodeURIComponent(accountId)}`
      + `&date=gte.${fromDate}&date=lte.${toDate}`
      + `&order=date.desc&limit=500`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!tradesRes.ok) {
    const text = await tradesRes.text();
    return { error: { status: 500, body: { error: text || 'Failed to load trades' } } };
  }
  const trades = await tradesRes.json();
  return { account, trades: Array.isArray(trades) ? trades : [] };
}

function validateScope(body) {
  const accountId = String(body?.account_id || '').trim();
  const fromDate = parseDateOnly(body?.from);
  const toDate = parseDateOnly(body?.to);
  const language = normalizeLanguage(body?.language);

  if (!accountId) {
    return { error: { status: 400, body: { error: 'account_id is required' } } };
  }
  if (!fromDate || !toDate) {
    return { error: { status: 400, body: { error: 'from and to must be YYYY-MM-DD' } } };
  }
  if (fromDate > toDate) {
    return { error: { status: 400, body: { error: 'from must be on or before to' } } };
  }
  if (daysBetween(fromDate, toDate) > MAX_RANGE_DAYS) {
    return { error: { status: 400, body: { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` } } };
  }
  return { accountId, fromDate, toDate, language };
}

async function prepareContext(req, deps) {
  const token = getBearerToken(req);
  const auth = await verifySupabaseUser({
    supabaseUrl: deps.supabaseUrl,
    anonKey: deps.anonKey,
    accessToken: token,
  });
  if (!auth.ok) {
    return { error: { status: auth.status, body: { error: auth.error } } };
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return { error: { status: 400, body: { error: 'Invalid JSON body' } } };
  }

  const scope = validateScope(body);
  if (scope.error) return scope;

  const loaded = await fetchAccountAndTrades({
    supabaseUrl: deps.supabaseUrl,
    anonKey: deps.anonKey,
    accessToken: token,
    userId: auth.user.id,
    accountId: scope.accountId,
    fromDate: scope.fromDate,
    toDate: scope.toDate,
  });
  if (loaded.error) return loaded;

  const summary = buildPerformanceSummary(loaded.trades, {
    account_id: loaded.account.id,
    account_name: loaded.account.name,
    from_date: scope.fromDate,
    to_date: scope.toDate,
  });

  return {
    user: auth.user,
    token,
    body,
    language: scope.language,
    summary,
    accountId: scope.accountId,
    fromDate: scope.fromDate,
    toDate: scope.toDate,
  };
}

function normalizeInsights(payload) {
  const list = Array.isArray(payload?.insights) ? payload.insights : [];
  const insights = [];
  for (const item of list) {
    const title = String(item?.title || '').trim().slice(0, 80);
    const detail = String(item?.detail || '').trim().slice(0, 280);
    let tone = String(item?.tone || 'neutral').trim().toLowerCase();
    if (!['positive', 'warning', 'neutral'].includes(tone)) tone = 'neutral';
    if (!title || !detail) continue;
    insights.push({ title, detail, tone });
    if (insights.length >= 6) break;
  }
  if (insights.length === 0) throw new Error('AI returned no insights');
  return insights;
}

function normalizeReport(payload) {
  const title = String(payload?.title || 'Performance report').trim().slice(0, 120);
  const summary = String(payload?.summary || '').trim().slice(0, 1200);
  const asList = (v, max = 5) => (Array.isArray(v) ? v : [])
    .map((x) => String(x || '').trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, max);
  const content = {
    summary,
    working: asList(payload?.working),
    hurting: asList(payload?.hurting),
    habits: asList(payload?.habits),
    action_plan: asList(payload?.action_plan),
    focus_next: String(payload?.focus_next || '').trim().slice(0, 200),
  };
  if (!content.summary) throw new Error('AI returned an empty report');
  return { title, content };
}

export async function handlePerformanceInsights(req, deps) {
  const ctx = await prepareContext(req, deps);
  if (ctx.error) return ctx.error;

  if (ctx.summary.trade_count === 0) {
    return { status: 400, body: { error: 'No trades in this account and date range' } };
  }
  if (!checkRateLimit(ctx.user.id, 'insights', 30)) {
    return { status: 429, body: { error: 'Too many insight requests. Try again later.' } };
  }

  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model,
    system: INSIGHTS_SYSTEM,
    user: `Language: ${ctx.language}\nStats summary JSON:\n${JSON.stringify(ctx.summary)}`,
  });
  if (ai.status !== 200) return ai;

  try {
    const parsed = extractJsonObject(ai.content);
    const insights = normalizeInsights(parsed);
    return { status: 200, body: { insights, summary: ctx.summary } };
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse insights' } };
  }
}

export async function handlePerformanceReport(req, deps) {
  const ctx = await prepareContext(req, deps);
  if (ctx.error) return ctx.error;

  if (ctx.summary.trade_count === 0) {
    return { status: 400, body: { error: 'No trades in this account and date range' } };
  }
  if (!checkRateLimit(ctx.user.id, 'report', 12)) {
    return { status: 429, body: { error: 'Too many report requests. Try again later.' } };
  }

  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model,
    system: REPORT_SYSTEM,
    user: `Language: ${ctx.language}\nStats summary JSON:\n${JSON.stringify(ctx.summary)}`,
    temperature: 0.4,
  });
  if (ai.status !== 200) return ai;

  let report;
  try {
    report = normalizeReport(extractJsonObject(ai.content));
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse report' } };
  }

  const insertRes = await fetch(`${deps.supabaseUrl}/rest/v1/ai_performance_reports`, {
    method: 'POST',
    headers: {
      apikey: deps.anonKey,
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: ctx.user.id,
      account_id: ctx.accountId,
      from_date: ctx.fromDate,
      to_date: ctx.toDate,
      language: ctx.language,
      title: report.title,
      content: report.content,
      stats_snapshot: {
        trade_count: ctx.summary.trade_count,
        win_rate: ctx.summary.win_rate,
        net_pnl: ctx.summary.net_pnl,
        avg_r: ctx.summary.avg_r,
        expectancy: ctx.summary.expectancy,
      },
    }),
  });

  if (!insertRes.ok) {
    const text = await insertRes.text();
    return { status: 500, body: { error: text || 'Failed to save report' } };
  }

  const rows = await insertRes.json();
  const saved = rows?.[0] || null;
  return {
    status: 200,
    body: {
      report: saved,
      title: report.title,
      content: report.content,
      summary: ctx.summary,
    },
  };
}

export async function handlePerformanceChat(req, deps) {
  const ctx = await prepareContext(req, deps);
  if (ctx.error) return ctx.error;

  if (ctx.summary.trade_count === 0) {
    return { status: 400, body: { error: 'No trades in this account and date range' } };
  }
  if (!checkRateLimit(ctx.user.id, 'chat', 40)) {
    return { status: 429, body: { error: 'Too many chat requests. Try again later.' } };
  }

  const message = String(ctx.body?.message || '').trim().slice(0, MAX_CHAT_MSG);
  if (!message) {
    return { status: 400, body: { error: 'message is required' } };
  }

  const history = Array.isArray(ctx.body?.history) ? ctx.body.history.slice(-MAX_CHAT_HISTORY) : [];
  const historyText = history
    .map((h) => `${h.role === 'assistant' ? 'Coach' : 'User'}: ${String(h.content || '').slice(0, 400)}`)
    .join('\n');

  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model,
    system: CHAT_SYSTEM,
    user: [
      `Language: ${ctx.language}`,
      `Stats summary JSON:\n${JSON.stringify(ctx.summary)}`,
      historyText ? `Recent chat:\n${historyText}` : '',
      `User: ${message}`,
    ].filter(Boolean).join('\n\n'),
    temperature: 0.45,
  });
  if (ai.status !== 200) return ai;

  try {
    const parsed = extractJsonObject(ai.content);
    const reply = String(parsed?.reply || '').trim().slice(0, 2000);
    if (!reply) throw new Error('Empty chat reply');
    return { status: 200, body: { reply } };
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse chat reply' } };
  }
}

export async function handleListPerformanceReports(req, deps) {
  const token = getBearerToken(req);
  const auth = await verifySupabaseUser({
    supabaseUrl: deps.supabaseUrl,
    anonKey: deps.anonKey,
    accessToken: token,
  });
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const url = new URL(req.url || '', 'http://localhost');
  const accountId = String(url.searchParams.get('account_id') || '').trim();
  let query = `${deps.supabaseUrl}/rest/v1/ai_performance_reports`
    + `?select=id,account_id,from_date,to_date,language,title,content,stats_snapshot,created_at`
    + `&user_id=eq.${encodeURIComponent(auth.user.id)}`
    + `&order=created_at.desc&limit=30`;
  if (accountId) {
    query += `&account_id=eq.${encodeURIComponent(accountId)}`;
  }

  const res = await fetch(query, {
    headers: {
      apikey: deps.anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return { status: 500, body: { error: text || 'Failed to load reports' } };
  }
  const reports = await res.json();
  return { status: 200, body: { reports: Array.isArray(reports) ? reports : [] } };
}

export async function handleDeletePerformanceReport(req, deps) {
  const token = getBearerToken(req);
  const auth = await verifySupabaseUser({
    supabaseUrl: deps.supabaseUrl,
    anonKey: deps.anonKey,
    accessToken: token,
  });
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  const url = new URL(req.url || '', 'http://localhost');
  let id = String(url.searchParams.get('id') || '').trim();
  if (!id) {
    try {
      const body = await readBody(req);
      id = String(body?.id || '').trim();
    } catch {
      id = '';
    }
  }
  if (!id) {
    return { status: 400, body: { error: 'id is required' } };
  }

  const res = await fetch(
    `${deps.supabaseUrl}/rest/v1/ai_performance_reports?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: deps.anonKey,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    return { status: 500, body: { error: text || 'Failed to delete report' } };
  }
  return { status: 200, body: { ok: true } };
}

export function getPerformanceDepsFromEnv(env = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    sealionApiKey: (env.SEALION_API_KEY || '').trim(),
    model: (env.SEALION_MODEL || '').trim() || undefined,
  };
}
