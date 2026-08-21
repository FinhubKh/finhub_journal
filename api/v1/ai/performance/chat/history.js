import { handleCorsPreflight, applyCors } from '../../../../_cors.js';
import {
  handleGetChatHistory,
  handleClearChatHistory,
  getPerformanceDepsFromEnv,
} from '../../../../../backend/api/ai-performance-handler.mjs';

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  const deps = getPerformanceDepsFromEnv(process.env);
  if (!deps.supabaseUrl || !deps.anonKey) {
    res.status(500).json({ error: 'Supabase is not configured' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await handleGetChatHistory(req, deps);
      res.status(result.status).json(result.body);
      return;
    }
    if (req.method === 'DELETE') {
      const result = await handleClearChatHistory(req, deps);
      res.status(result.status).json(result.body);
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'AI chat history request failed' });
  }
}
