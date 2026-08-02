import { loadEnv } from './backend/api/load-env.mjs';
import { handleSaveInvestorCredentials } from './backend/api/investor-credentials-handler.mjs';
import { handleTriggerInvestorSync } from './backend/api/investor-sync-handler.mjs';
import { handleBridgeSync } from './backend/api/bridge-sync-handler.mjs';
import {
  handleConnectInvestorCredentials,
  handleInvestorVerifyStatus,
} from './backend/api/investor-connect-handler.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function bridgeDeps(env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    encryptionKey: env.INVESTOR_CRED_ENCRYPTION_KEY,
    bridgeUrl: (env.MT5_BRIDGE_URL || '').replace(/\/$/, ''),
    bridgeServiceToken: env.BRIDGE_SERVICE_TOKEN,
  };
}

function connectReady(deps) {
  return Boolean(
    deps.supabaseUrl
    && deps.anonKey
    && deps.serviceKey
    && deps.encryptionKey
    && deps.bridgeUrl
    && deps.bridgeServiceToken,
  );
}

export function bridgeDevApiPlugin() {
  return {
    name: 'finhub-bridge-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];
        const isBridge = pathname === '/v1/bridge/sync';
        const isCreds = pathname === '/v1/investor-credentials';
        const isSync = pathname === '/v1/investor-sync';
        const isConnect = pathname === '/v1/investor-connect';
        const isVerify = pathname === '/v1/investor-verify';
        if (!isBridge && !isCreds && !isSync && !isConnect && !isVerify) return next();

        const env = loadEnv();
        const deps = bridgeDeps(env);

        try {
          let result;
          if (isBridge) {
            if (req.method !== 'POST') {
              sendJson(res, 405, { error: 'Method not allowed' });
              return;
            }
            if (!deps.supabaseUrl || !deps.serviceKey || !deps.bridgeServiceToken) {
              sendJson(res, 500, { error: 'Bridge sync service is not configured' });
              return;
            }
            result = await handleBridgeSync(req, deps);
          } else if (isCreds) {
            if (req.method !== 'POST') {
              sendJson(res, 405, { error: 'Method not allowed' });
              return;
            }
            if (!deps.supabaseUrl || !deps.anonKey || !deps.serviceKey || !deps.encryptionKey) {
              sendJson(res, 500, { error: 'Investor credentials service is not configured' });
              return;
            }
            result = await handleSaveInvestorCredentials(req, deps);
          } else if (isConnect) {
            if (req.method !== 'POST') {
              sendJson(res, 405, { error: 'Method not allowed' });
              return;
            }
            if (!connectReady(deps)) {
              sendJson(res, 500, { error: 'Investor connect service is not configured' });
              return;
            }
            result = await handleConnectInvestorCredentials(req, deps);
          } else if (isVerify) {
            if (req.method !== 'GET') {
              sendJson(res, 405, { error: 'Method not allowed' });
              return;
            }
            if (!connectReady(deps)) {
              sendJson(res, 500, { error: 'Investor verify service is not configured' });
              return;
            }
            const qs = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
            const params = new URLSearchParams(qs);
            req.query = {
              job_id: params.get('job_id') || '',
              trading_account_id: params.get('trading_account_id') || '',
            };
            result = await handleInvestorVerifyStatus(req, deps);
          } else {
            if (req.method !== 'POST') {
              sendJson(res, 405, { error: 'Method not allowed' });
              return;
            }
            if (
              !deps.supabaseUrl
              || !deps.anonKey
              || !deps.serviceKey
              || !deps.encryptionKey
              || !deps.bridgeUrl
              || !deps.bridgeServiceToken
            ) {
              sendJson(res, 500, { error: 'Investor sync service is not configured' });
              return;
            }
            result = await handleTriggerInvestorSync(req, deps);
          }
          sendJson(res, result.status, result.body);
        } catch (err) {
          sendJson(res, 500, { error: err.message || 'Bridge request failed' });
        }
      });
    },
  };
}
