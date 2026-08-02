import { loadEnv } from './backend/api/load-env.mjs';
import { handleSaveInvestorCredentials } from './backend/api/investor-credentials-handler.mjs';
import { handleTriggerInvestorSync } from './backend/api/investor-sync-handler.mjs';
import { handleBridgeSync } from './backend/api/bridge-sync-handler.mjs';

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

export function bridgeDevApiPlugin() {
  return {
    name: 'finhub-bridge-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        const isBridge = pathname === '/v1/bridge/sync';
        const isCreds = pathname === '/v1/investor-credentials';
        const isSync = pathname === '/v1/investor-sync';
        if (!isBridge && !isCreds && !isSync) return next();

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        const env = loadEnv();
        const deps = bridgeDeps(env);

        try {
          let result;
          if (isBridge) {
            if (!deps.supabaseUrl || !deps.serviceKey || !deps.bridgeServiceToken) {
              sendJson(res, 500, { error: 'Bridge sync service is not configured' });
              return;
            }
            result = await handleBridgeSync(req, deps);
          } else if (isCreds) {
            if (!deps.supabaseUrl || !deps.anonKey || !deps.serviceKey || !deps.encryptionKey) {
              sendJson(res, 500, { error: 'Investor credentials service is not configured' });
              return;
            }
            result = await handleSaveInvestorCredentials(req, deps);
          } else {
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
