/**
 * AI performance advisor via SEA-LION.
 * Loads user trades with their JWT (RLS), builds a stats summary, then advises.
 */

import { verifySupabaseUser, readJsonBody, DEFAULT_MODEL } from './ai-checklist-handler.mjs';
import {
  buildPerformanceSummary,
  buildAdvisorBrief,
} from './performance-stats.mjs';

const SEA_LION_BASE = 'https://api.sea-lion.ai/v1';
const MAX_RANGE_DAYS = 180;
const MAX_CHAT_MSG = 800;
const MAX_CHAT_HISTORY = 8;
/** Prefer Gemma for latency — Qwen often hangs past Vercel gateway limits (504). */
const FAST_MODEL = 'aisingapore/Gemma-SEA-LION-v4-27B-IT';
const SEALION_TIMEOUT_MS = 55000;
const TRADE_SELECT = [
  'date', 'result', 'r_value', 'pnl_usd', 'session', 'symbol', 'direction', 'model',
].join(',');

const rateBuckets = new Map();

const INSIGHTS_SYSTEM = `You are an elite trading performance advisor for FinHubKH Journal.
Traders use this to improve process, risk, and edge — not for motivational fluff.

Return ONLY valid JSON:
{"insights":[{"title":"Short title","detail":"2-4 sentences with specific numbers from the stats","tone":"positive|warning|neutral"}]}

Rules:
- Return exactly 6 insights with a balanced tone mix: 2 positive, 2 warning, 2 neutral
- tone mapping: positive = Strengths, warning = Risks, neutral = Focus (actionable next-step items)
- Cover different angles across the set: edge quality, session/symbol/weekday edge, risk/payoff, streaks/discipline, direction or model bias when data exists
- positive: relative strengths only (best session/symbol/weekday/direction, payoff bright spots, or least-damaging context) — still cite numbers; never invent wins that are not in the stats
- warning: concrete leaks and risks with numbers
- neutral: actionable focus rules for the next period (when to trade, stand down, size, or review) tied to the stats
- Every insight MUST cite concrete stats (win rate, PnL, avg R, expectancy, session/symbol names, streak counts)
- Explain WHY it matters for the next trading week and what to change
- No generic advice like "stay disciplined" unless tied to a number in the data
- No fluff, no markdown, no code fences
- Do not invent trades or numbers not in the stats
- Write in the requested language (en or km)`;

const REPORT_SYSTEM = `You are an elite trading performance advisor for FinHubKH Journal.
Write a detailed process review a serious discretionary/system trader would actually use.

Return ONLY valid JSON:
{"title":"Report title","summary":"...","working":["..."],"hurting":["..."],"habits":["..."],"action_plan":["..."],"focus_next":"Primary focus for next period"}

Rules:
- summary: 4 to 6 sentences covering net result, expectancy/payoff, strongest and weakest contexts (session/symbol/weekday/direction), and the main process risk
- working / hurting / habits / action_plan: 4 to 6 items each
- Each list item must be specific and include numbers from the stats when relevant
- action_plan items must be concrete process rules (when to trade, when to stand down, size rules, review rules) — not vague tips
- Base only on provided stats; do not invent numbers
- No markdown, no code fences
- Write in the requested language (en or km)`;

const CHAT_SYSTEM = `You are an elite trading performance advisor for FinHubKH Journal.
Answer using ONLY the provided stats for the selected account and date range.
Be specific with numbers. If the answer is not in the data, say you do not have that information.
No trade placement or broker advice. Advisory guidance and process review only.
Reply in the requested language (en or km), or match the user's message language if clearer.
Return ONLY valid JSON: {"reply":"your answer"}`;

const ANALYZE_SYSTEM = `You are an elite trading performance advisor for FinHubKH Journal.
Your job is a serious post-period review that helps the trader improve edge, risk, and process.

Return ONLY valid JSON:
{
  "insights":[{"title":"Short title","detail":"2-4 sentences with specific numbers","tone":"positive|warning|neutral"}],
  "report":{
    "title":"Report title",
    "summary":"4-6 sentences covering results, expectancy/payoff, best/worst contexts, and main process risk",
    "working":["specific strength with numbers"],
    "hurting":["specific leak with numbers"],
    "habits":["behavior or pattern flag with numbers"],
    "action_plan":["concrete process rule for next period"],
    "focus_next":"One primary focus for the next period"
  }
}

Rules:
- Exactly 6 insights with a balanced tone mix: 2 positive, 2 warning, 2 neutral
- tone mapping: positive = Strengths, warning = Risks, neutral = Focus (actionable next-step items)
- Cover different angles (overall edge, session or weekday, symbol or model, risk/payoff, discipline/streaks)
- positive: relative strengths only (best context or least-damaging pattern) with numbers — never invent wins not in the stats
- warning: concrete leaks and risks with numbers
- neutral: actionable focus rules for the next period tied to the stats
- working, hurting, habits, action_plan: 4 to 5 items each
- Every point must reference real stats from the input (WR, PnL, avg R, expectancy, profit factor, streaks, session/symbol/weekday/direction splits)
- Ban generic lines like "be more disciplined" or "manage risk" unless tied to a specific number and a rule
- action_plan must be executable rules (e.g. "Stand aside in X session after 2 losses", "Only trade Y when Z WR context holds")
- Do not invent trades or numbers
- No markdown, no code fences
- Write in the requested language (en or km)`;

function userFromAccessToken(token) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json);
    if (!payload?.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { id: payload.sub };
  } catch {
    return null;
  }
}

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

async function sealionChat({
  apiKey,
  model,
  system,
  user,
  temperature = 0.3,
  maxTokens = 900,
}) {
  if (!apiKey) {
    return { status: 500, body: { error: 'SEA-LION API key is not configured' } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEALION_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${SEA_LION_BASE}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        model: model || FAST_MODEL || DEFAULT_MODEL,
        temperature,
        max_tokens: maxTokens,
        // Qwen-SEA-LION defaults to long reasoning; turn it off for latency.
        chat_template_kwargs: {
          enable_thinking: false,
          thinking_mode: 'off',
        },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return {
        status: 504,
        body: { error: 'AI took too long. Please try again.' },
      };
    }
    return {
      status: 502,
      body: { error: err?.message || 'SEA-LION request failed' },
    };
  } finally {
    clearTimeout(timer);
  }

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
    const msg = data?.choices?.[0]?.message || {};
    content = String(msg.content || '').trim();
    // Some SEA-LION responses put usable text only in reasoning_content.
    if (!content) {
      content = String(msg.reasoning_content || '').trim();
    }
  } catch {
    content = rawText;
  }
  return { status: 200, content };
}

export async function embedText({ supabaseUrl, embedSecret, text }) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-embed-secret': embedSecret },
      body: JSON.stringify({ mode: 'query', content: text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.embedding) ? data.embedding : null;
  } catch {
    return null;
  }
}

/** Semantic search over the trader's own journal notes. Empty array on any failure — chat/report always fall back to stats-only grounding. */
export async function retrieveJournalContext({
  supabaseUrl,
  anonKey,
  embedFunctionSecret,
  accessToken,
  accountId,
  queryText,
  fromDate = null,
  toDate = null,
  matchCount = 8,
}) {
  if (!embedFunctionSecret || !String(queryText || '').trim()) return [];

  const embedding = await embedText({ supabaseUrl, embedSecret: embedFunctionSecret, text: queryText });
  if (!embedding) return [];

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/match_journal_embeddings`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_account_id: accountId,
        p_query_embedding: embedding,
        p_from: fromDate,
        p_to: toDate,
        p_match_count: matchCount,
      }),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
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
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };

  const [accountRes, tradesRes] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/trading_accounts?select=id,name&id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/trades?select=${TRADE_SELECT}`
        + `&user_id=eq.${encodeURIComponent(userId)}`
        + `&account_id=eq.${encodeURIComponent(accountId)}`
        + `&date=gte.${fromDate}&date=lte.${toDate}`
        + `&order=date.desc&limit=300`,
      { headers },
    ),
  ]);

  if (accountRes.status === 401 || tradesRes.status === 401) {
    return { error: { status: 401, body: { error: 'Unauthorized' } } };
  }
  if (!accountRes.ok) {
    const text = await accountRes.text();
    return { error: { status: 500, body: { error: text || 'Failed to load account' } } };
  }
  if (!tradesRes.ok) {
    const text = await tradesRes.text();
    return { error: { status: 500, body: { error: text || 'Failed to load trades' } } };
  }

  const [accounts, trades] = await Promise.all([accountRes.json(), tradesRes.json()]);
  const account = accounts?.[0];
  if (!account) {
    return { error: { status: 404, body: { error: 'Trading account not found' } } };
  }
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
  // Decode JWT locally — Supabase RLS still validates the token on data fetch.
  // Skips an extra auth/v1/user round-trip on every AI request.
  const user = userFromAccessToken(token);
  if (!user) {
    return { error: { status: 401, body: { error: 'Unauthorized' } } };
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
    userId: user.id,
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
    user,
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
    const title = String(item?.title || '').trim().slice(0, 100);
    const detail = String(item?.detail || item?.description || item?.text || '').trim().slice(0, 600);
    let tone = String(item?.tone || 'neutral').trim().toLowerCase();
    if (!['positive', 'warning', 'neutral'].includes(tone)) tone = 'neutral';
    if (!title || !detail) continue;
    insights.push({ title, detail, tone });
    if (insights.length >= 6) break;
  }
  if (insights.length === 0) throw new Error('AI returned no insights');
  return insights;
}

function asReportList(v, max = 6) {
  return (Array.isArray(v) ? v : [])
    .map((x) => String(x || '').trim().slice(0, 360))
    .filter(Boolean)
    .slice(0, max);
}

/** Prefer nested report only when it actually has a summary. */
function pickReportPayload(parsed) {
  const nested = parsed?.report;
  const nestedSummary = nested && typeof nested === 'object'
    ? String(nested.summary || nested.overview || nested.analysis || '').trim()
    : '';
  if (nestedSummary) return nested;

  const topSummary = String(
    parsed?.summary || parsed?.overview || parsed?.analysis || '',
  ).trim();
  if (topSummary) return parsed;

  // Model returned insights but a hollow/missing report — synthesize a usable report.
  const insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
  if (insights.length > 0) {
    const lines = insights
      .map((i) => {
        const t = String(i?.title || '').trim();
        const d = String(i?.detail || i?.description || '').trim();
        return [t, d].filter(Boolean).join(': ');
      })
      .filter(Boolean);
    return {
      title: String(parsed?.title || 'Performance report').trim() || 'Performance report',
      summary: lines.join(' ').slice(0, 1200),
      working: asReportList(parsed?.working || nested?.working),
      hurting: asReportList(parsed?.hurting || nested?.hurting),
      habits: asReportList(parsed?.habits || nested?.habits),
      action_plan: asReportList(parsed?.action_plan || nested?.action_plan || parsed?.actions),
      focus_next: String(
        parsed?.focus_next || nested?.focus_next || insights[0]?.title || '',
      ).trim(),
    };
  }

  if (nested && typeof nested === 'object') return nested;
  return parsed || {};
}

function normalizeReport(payload) {
  const title = String(payload?.title || 'Performance report').trim().slice(0, 140) || 'Performance report';
  const summary = String(
    payload?.summary || payload?.overview || payload?.analysis || '',
  ).trim().slice(0, 2500);
  const content = {
    summary,
    working: asReportList(payload?.working),
    hurting: asReportList(payload?.hurting),
    habits: asReportList(payload?.habits),
    action_plan: asReportList(payload?.action_plan || payload?.actions),
    focus_next: String(payload?.focus_next || payload?.focus || '').trim().slice(0, 320),
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

  const brief = buildAdvisorBrief(ctx.summary);
  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model || FAST_MODEL,
    system: INSIGHTS_SYSTEM,
    user: `Language: ${ctx.language}\nStats:\n${JSON.stringify(brief)}`,
    maxTokens: 700,
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

/** Stats only, no LLM call — powers the instant metrics strip. Never errors on zero trades. */
export async function handlePerformanceStats(req, deps) {
  const ctx = await prepareContext(req, deps);
  if (ctx.error) return ctx.error;
  if (!checkRateLimit(ctx.user.id, 'stats', 60)) {
    return { status: 429, body: { error: 'Too many stats requests. Try again later.' } };
  }
  return { status: 200, body: { summary: ctx.summary } };
}

async function savePerformanceReport(deps, ctx, report) {
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
    return { error: { status: 500, body: { error: text || 'Failed to save report' } } };
  }

  const rows = await insertRes.json();
  return { saved: rows?.[0] || null };
}

function unsavedReportRow(ctx, report) {
  return {
    id: null,
    title: report.title,
    content: report.content,
    from_date: ctx.fromDate,
    to_date: ctx.toDate,
    language: ctx.language,
    created_at: new Date().toISOString(),
  };
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

  const brief = buildAdvisorBrief(ctx.summary);
  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model || FAST_MODEL,
    system: REPORT_SYSTEM,
    user: `Language: ${ctx.language}\nStats:\n${JSON.stringify(brief)}`,
    temperature: 0.3,
    maxTokens: 1000,
  });
  if (ai.status !== 200) return ai;

  let report;
  try {
    report = normalizeReport(pickReportPayload(extractJsonObject(ai.content)));
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse report' } };
  }

  const savedRes = await savePerformanceReport(deps, ctx, report);
  if (savedRes.error) return savedRes.error;

  return {
    status: 200,
    body: {
      report: savedRes.saved,
      title: report.title,
      content: report.content,
      summary: ctx.summary,
    },
  };
}

/**
 * Get analysis: one LLM call for insights + report (compact prompt, fast model).
 */
export async function handlePerformanceAnalyze(req, deps) {
  const ctx = await prepareContext(req, deps);
  if (ctx.error) return ctx.error;

  if (ctx.summary.trade_count === 0) {
    return { status: 400, body: { error: 'No trades in this account and date range' } };
  }
  if (!checkRateLimit(ctx.user.id, 'analyze', 12)) {
    return { status: 429, body: { error: 'Too many analysis requests. Try again later.' } };
  }

  const brief = buildAdvisorBrief(ctx.summary);

  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model || FAST_MODEL,
    system: ANALYZE_SYSTEM,
    user: [
      `Language: ${ctx.language}`,
      'Write a detailed trader performance review from these stats.',
      'Cite numbers. Give executable next-period rules.',
      `Stats JSON:\n${JSON.stringify(brief)}`,
    ].join('\n\n'),
    temperature: 0.35,
    maxTokens: 1800,
  });
  if (ai.status !== 200) return ai;

  let insights;
  let report;
  try {
    const parsed = extractJsonObject(ai.content);
    insights = normalizeInsights(parsed);
    report = normalizeReport(pickReportPayload(parsed));
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse analysis' } };
  }

  // Prefer returning AI result even if save is slow (avoids gateway 504).
  let saved = unsavedReportRow(ctx, report);
  try {
    const savedRes = await Promise.race([
      savePerformanceReport(deps, ctx, report),
      new Promise((resolve) => {
        setTimeout(() => resolve({ timeout: true }), 2500);
      }),
    ]);
    if (savedRes?.saved) saved = savedRes.saved;
  } catch {
    // keep unsaved row
  }

  return {
    status: 200,
    body: {
      insights,
      report: saved,
      title: report.title,
      content: report.content,
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
    .map((h) => `${h.role === 'assistant' ? 'Advisor' : 'User'}: ${String(h.content || '').slice(0, 400)}`)
    .join('\n');

  const brief = buildAdvisorBrief(ctx.summary);
  const ai = await sealionChat({
    apiKey: deps.sealionApiKey,
    model: deps.model || FAST_MODEL,
    system: CHAT_SYSTEM,
    user: [
      `Language: ${ctx.language}`,
      `Stats:\n${JSON.stringify(brief)}`,
      historyText ? `Recent chat:\n${historyText}` : '',
      `User: ${message}`,
    ].filter(Boolean).join('\n\n'),
    temperature: 0.35,
    maxTokens: 600,
  });
  if (ai.status !== 200) return ai;

  try {
    const parsed = extractJsonObject(ai.content);
    const reply = String(parsed?.reply || '').trim().slice(0, 3500);
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
    embedFunctionSecret: (env.EMBED_FUNCTION_SECRET || '').trim(),
  };
}
