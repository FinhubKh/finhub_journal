import { handleCorsPreflight, applyCors } from '../_cors.js';
import { handleSaveInvestorCredentials, getInvestorCredentialsDepsFromEnv } from '../../backend/api/investor-credentials-handler.mjs';
import { handleTriggerInvestorSync, getInvestorSyncDepsFromEnv } from '../../backend/api/investor-sync-handler.mjs';
import { handleBridgeSync, getBridgeSyncDepsFromEnv } from '../../backend/api/bridge-sync-handler.mjs';
import {
  handleConnectInvestorCredentials,
  handleInvestorVerifyStatus,
  getInvestorConnectDepsFromEnv,
} from '../../backend/api/investor-connect-handler.mjs';

export const config = {
  maxDuration: 30,
};

function resolveRoute(req) {
  const fromQuery = String(req.query?.route || '').trim();
  if (fromQuery) return fromQuery;

  const url = String(req.url || '');
  if (url.includes('investor-connect')) return 'investor-connect';
  if (url.includes('investor-verify')) return 'investor-verify';
  if (url.includes('investor-credentials')) return 'investor-credentials';
  if (url.includes('investor-sync')) return 'investor-sync';
  if (url.includes('bridge')) return 'bridge-sync';
  return '';
}

function connectDepsReady(deps) {
  return Boolean(
    deps.supabaseUrl
    && deps.anonKey
    && deps.serviceKey
    && deps.encryptionKey
    && deps.bridgeUrl
    && deps.bridgeServiceToken,
  );
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  const route = resolveRoute(req);

  try {
    if (route === 'bridge-sync') {
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
      return;
    }

    if (route === 'investor-credentials') {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
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
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const deps = getInvestorSyncDepsFromEnv(process.env);
      if (
        !deps.supabaseUrl
        || !deps.anonKey
        || !deps.serviceKey
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

    if (route === 'investor-connect') {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const deps = getInvestorConnectDepsFromEnv(process.env);
      if (!connectDepsReady(deps)) {
        res.status(500).json({ error: 'Investor connect service is not configured' });
        return;
      }
      const result = await handleConnectInvestorCredentials(req, deps);
      res.status(result.status).json(result.body);
      return;
    }

    if (route === 'investor-verify') {
      if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const deps = getInvestorConnectDepsFromEnv(process.env);
      if (!connectDepsReady(deps)) {
        res.status(500).json({ error: 'Investor verify service is not configured' });
        return;
      }
      const result = await handleInvestorVerifyStatus(req, deps);
      res.status(result.status).json(result.body);
      return;
    }

    res.status(404).json({ error: 'Unknown MT5 bridge route' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'MT5 bridge request failed' });
  }
}
