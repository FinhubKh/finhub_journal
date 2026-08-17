/**
 * Shared CORS helpers for Vercel serverless API routes.
 */

const ALLOWED_ORIGINS = new Set([
  'https://journal.finhubkh.com',
  'https://finhubjournal.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    // Only this project's Vercel previews (finhubjournal*) — not every *.vercel.app app.
    return host === 'finhubjournal.vercel.app' || /^finhubjournal(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host);
  } catch {
    return false;
  }
}

export function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleCorsPreflight(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
