import { handleBridgeSync, getBridgeSyncDepsFromEnv } from '../../../backend/api/bridge-sync-handler.mjs';

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const deps = getBridgeSyncDepsFromEnv(process.env);
  if (!deps.supabaseUrl || !deps.serviceKey || !deps.bridgeServiceToken) {
    res.status(500).json({ error: 'Bridge sync service is not configured' });
    return;
  }

  const result = await handleBridgeSync(req, deps);
  res.status(result.status).json(result.body);
}
