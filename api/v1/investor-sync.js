import { handleCorsPreflight, applyCors } from '../_cors.js';
import { handleTriggerInvestorSync, getInvestorSyncDepsFromEnv } from '../../backend/api/investor-sync-handler.mjs';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const deps = getInvestorSyncDepsFromEnv(process.env);
  if (!deps.supabaseUrl || !deps.anonKey || !deps.serviceKey || !deps.encryptionKey || !deps.bridgeUrl || !deps.bridgeServiceToken) {
    res.status(500).json({ error: 'Investor sync service is not configured' });
    return;
  }

  try {
    const result = await handleTriggerInvestorSync(req, deps);
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to trigger investor sync' });
  }
}
