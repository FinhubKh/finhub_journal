import { handleCorsPreflight, applyCors } from '../../_cors.js';
import {
  generateChecklistSteps,
  verifySupabaseUser,
} from '../../../backend/api/ai-checklist-handler.mjs';

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const sealionApiKey = (process.env.SEALION_API_KEY || '').trim();
  const model = (process.env.SEALION_MODEL || '').trim() || undefined;

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  try {
    const auth = await verifySupabaseUser({
      supabaseUrl,
      anonKey,
      accessToken: getBearerToken(req),
    });
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    const result = await generateChecklistSteps({
      prompt: body.prompt,
      apiKey: sealionApiKey,
      model,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: err.message || 'AI checklist failed' });
  }
}
