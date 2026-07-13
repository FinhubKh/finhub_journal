import { authFetch, getToken } from './auth';
import { EA_WEBREQUEST_ORIGIN } from './env';

function resolveAiApiBase() {
  if (import.meta.env.VITE_AI_API_URL) {
    return import.meta.env.VITE_AI_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return '';
  }
  return EA_WEBREQUEST_ORIGIN || '';
}

const AI_API_BASE = resolveAiApiBase();

export async function generateChecklistWithAi(prompt) {
  const res = await authFetch(`${AI_API_BASE}/v1/ai/checklist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ prompt }),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(body?.error || `AI request failed (${res.status})`);
  }

  const steps = Array.isArray(body?.steps) ? body.steps : [];
  if (steps.length === 0) {
    throw new Error('No checklist steps were generated');
  }
  return steps;
}
