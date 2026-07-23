import { authFetch, getToken } from './auth';

function resolveAiApiBase() {
  if (import.meta.env.VITE_AI_API_URL) {
    return import.meta.env.VITE_AI_API_URL.replace(/\/$/, '');
  }
  // Same-origin in both Vite dev (plugin) and Vercel prod (rewrites).
  // Avoids CORS when the site is served from journal.finhubkh.com.
  return '';
}

const AI_API_BASE = resolveAiApiBase();

async function parseAiResponse(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new Error(body?.error || `AI request failed (${res.status})`);
  }
  return body;
}

export async function generateChecklistWithAi(prompt) {
  const res = await authFetch(`${AI_API_BASE}/v1/ai/checklist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ prompt }),
  });

  const body = await parseAiResponse(res);
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  if (steps.length === 0) {
    throw new Error('No checklist steps were generated');
  }
  return steps;
}

function performancePayload({ accountId, from, to, language, extra = {} }) {
  return {
    account_id: accountId,
    from,
    to,
    language,
    ...extra,
  };
}

export async function fetchAiPerformanceInsights({ accountId, from, to, language }) {
  const res = await authFetch(`${AI_API_BASE}/v1/ai/performance/insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(performancePayload({ accountId, from, to, language })),
  });
  const body = await parseAiResponse(res);
  return {
    insights: Array.isArray(body?.insights) ? body.insights : [],
    summary: body?.summary || null,
  };
}

export async function generateAiPerformanceReport({ accountId, from, to, language }) {
  const res = await authFetch(`${AI_API_BASE}/v1/ai/performance/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(performancePayload({ accountId, from, to, language })),
  });
  return parseAiResponse(res);
}

/** Single request: insights + report in one SEA-LION call. */
export async function analyzeAiPerformance({ accountId, from, to, language }) {
  const res = await authFetch(`${AI_API_BASE}/v1/ai/performance/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(performancePayload({ accountId, from, to, language })),
  });
  const body = await parseAiResponse(res);
  return {
    insights: Array.isArray(body?.insights) ? body.insights : [],
    report: body?.report || null,
    title: body?.title,
    content: body?.content,
    summary: body?.summary || null,
  };
}

export async function chatAiPerformance({ accountId, from, to, language, message, history = [] }) {
  const res = await authFetch(`${AI_API_BASE}/v1/ai/performance/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(performancePayload({
      accountId,
      from,
      to,
      language,
      extra: { message, history },
    })),
  });
  const body = await parseAiResponse(res);
  return String(body?.reply || '').trim();
}

export async function listAiPerformanceReports(accountId) {
  const q = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
  const res = await authFetch(`${AI_API_BASE}/v1/ai/performance/reports${q}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  const body = await parseAiResponse(res);
  return Array.isArray(body?.reports) ? body.reports : [];
}

export async function deleteAiPerformanceReport(id) {
  const res = await authFetch(
    `${AI_API_BASE}/v1/ai/performance/reports?id=${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    },
  );
  return parseAiResponse(res);
}
