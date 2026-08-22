import { handleCorsPreflight, applyCors } from '../../../_cors.js';
import { handlePerformanceStats, getPerformanceDepsFromEnv } from '../../../../backend/api/ai-performance-handler.mjs';

export const config = {
  maxDuration: 15,
};

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const deps = getPerformanceDepsFromEnv(process.env);
  if (!deps.supabaseUrl || !deps.anonKey) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  try {
    const result = await handlePerformanceStats(req, deps);
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: err.message || 'AI stats request failed' });
  }
}
