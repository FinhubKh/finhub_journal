import { handleEaSync } from '../../../backend/api/sync-handler.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const syncKey = req.headers['x-sync-key'];
  const trades = req.body?.trades;
  const accountMeta = req.body?.account_meta;
  const result = await handleEaSync({ syncKey, trades, accountMeta, supabaseUrl, serviceKey });
  res.status(result.status).json(result.body);
}
