/**
 * Generate pre-trade checklist steps via SEA-LION API.
 * API key stays server-side (SEALION_API_KEY).
 */

const SEA_LION_BASE = 'https://api.sea-lion.ai/v1';
const DEFAULT_MODEL = 'aisingapore/Qwen-SEA-LION-v4.5-27B-IT';
const MAX_PROMPT_LEN = 1200;
const MAX_STEPS = 24;

const SYSTEM_PROMPT = `You are a trading coach that writes short pre-trade checklist steps.
Return ONLY valid JSON with this shape:
{"steps":[{"section":"Section name","title":"Short actionable step"}]}

Rules:
- 6 to 16 steps total
- Group into 2 to 5 sections (e.g. Bias, Setup, Risk, Execution)
- Each title is one clear yes/no check (max ~80 characters)
- No markdown, no commentary, no code fences
- Language matches the user prompt (English or Khmer if asked)`;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
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

function normalizeSteps(payload) {
  const list = Array.isArray(payload?.steps) ? payload.steps : [];
  const steps = [];
  for (const item of list) {
    const section = String(item?.section || '').trim().slice(0, 80);
    const title = String(item?.title || '').trim().slice(0, 120);
    if (!section || !title) continue;
    steps.push({ section, title });
    if (steps.length >= MAX_STEPS) break;
  }
  if (steps.length === 0) {
    throw new Error('AI returned no usable checklist steps');
  }
  return steps;
}

export async function verifySupabaseUser({ supabaseUrl, anonKey, accessToken }) {
  if (!accessToken) {
    return { ok: false, status: 401, error: 'Missing authorization' };
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const user = await res.json();
  if (!user?.id) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, user };
}

export async function generateChecklistSteps({ prompt, apiKey, model }) {
  const cleanPrompt = String(prompt || '').trim().slice(0, MAX_PROMPT_LEN);
  if (!cleanPrompt) {
    return { status: 400, body: { error: 'Prompt is required' } };
  }
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
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Create a pre-trade checklist for:\n${cleanPrompt}`,
        },
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

  try {
    const parsed = extractJsonObject(content);
    const steps = normalizeSteps(parsed);
    return { status: 200, body: { steps } };
  } catch (err) {
    return { status: 502, body: { error: err.message || 'Could not parse AI checklist' } };
  }
}

export async function handleAiChecklistRequest(req, {
  supabaseUrl,
  anonKey,
  sealionApiKey,
  model,
}) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const auth = await verifySupabaseUser({
    supabaseUrl,
    anonKey,
    accessToken: token,
  });
  if (!auth.ok) {
    return { status: auth.status, body: { error: auth.error } };
  }

  let body;
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      body = await readJsonBody(req);
    }
  } catch {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }

  return generateChecklistSteps({
    prompt: body?.prompt,
    apiKey: sealionApiKey,
    model,
  });
}

export { readJsonBody, DEFAULT_MODEL };
