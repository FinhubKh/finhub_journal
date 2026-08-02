import { handleCorsPreflight, applyCors } from '../_cors.js';
import { handleSaveInvestorCredentials, getInvestorCredentialsDepsFromEnv } from '../../backend/api/investor-credentials-handler.mjs';
import { handleTriggerInvestorSync, getInvestorSyncDepsFromEnv } from '../../backend/api/investor-sync-handler.mjs';
import { handleBridgeSync, getBridgeSyncDepsFromEnv } from '../../backend/api/bridge-sync-handler.mjs';

export const config = {
  maxDuration: 30,
};

function resolveRoute(req) {
  const fromQuery = String(req.query?.route || '').trim();
  if (fromQuery) return fromQuery;

  const url = String(req.url || '');
  if (url.includes('investor-credentials')) return 'investor-credentials';
  if (url.includes('investor-sync')) return 'investor-sync';
  if (url.includes('bridge')) return 'bridge-sync';
  return '';
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const route = resolveRoute(req);

  try {
    if (route === 'bridge-sync') {
      const deps = getBridgeSyncDepsFromEnv(process.env);
      if (!deps.supabaseUrl || !deps.serviceKey || !deps.bridgeServiceToken) {
        res.status(500).json({ error: 'Bridge sync service is not configured' });
        return;
      }
      const result = await handleBridgeSync(req, deps);
      res.status(result.status).json(result.body);
      return;
    }

    if (route === 'investor-credentials') {
      const deps = getInvestorCredentialsDepsFromEnv(process.env);
      if (!deps.supabaseUrl || !deps.anonKey || !deps.serviceKey || !deps.encryptionKey) {
        res.status(500).json({ error: 'Investor credentials service is not configured' });
        return;
      }
      const result = await handleSaveInvestorCredentials(req, deps);
      res.status(result.status).json(result.body);
      return;
    }

    if (route === 'investor-sync') {
      const deps = getInvestorSyncDepsFromEnv(process.env);
      if (
        !deps.supabaseUrl
        || !deps.anonKey
        || !deps.serviceKey
        || !deps.encryptionKey
        || !deps.bridgeUrl
        || !deps.bridgeServiceToken
      ) {
        res.status(500).json({ error: 'Investor sync service is not configured' });
        return;
      }
      const result = await handleTriggerInvestorSync(req, deps);
      res.status(result.status).json(result.body);
      return;
    }

    res.status(404).json({ error: 'Unknown MT5 bridge route' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'MT5 bridge request failed' });
  }
}
