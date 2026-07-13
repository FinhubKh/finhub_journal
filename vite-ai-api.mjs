import { loadEnv } from './backend/api/load-env.mjs';
import { handleAiChecklistRequest } from './backend/api/ai-checklist-handler.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function aiDevApiPlugin() {
  return {
    name: 'finhub-ai-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname !== '/v1/ai/checklist') return next();

        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        const env = loadEnv();
        const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
        const anonKey = env.VITE_SUPABASE_ANON_KEY;
        const sealionApiKey = (env.SEALION_API_KEY || '').trim();
        const model = (env.SEALION_MODEL || '').trim() || undefined;

        if (!supabaseUrl || !anonKey) {
          sendJson(res, 500, { error: 'Supabase is not configured' });
          return;
        }

        try {
          const result = await handleAiChecklistRequest(req, {
            supabaseUrl,
            anonKey,
            sealionApiKey,
            model,
          });
          sendJson(res, result.status, result.body);
        } catch (err) {
          sendJson(res, 500, { error: err.message || 'AI checklist failed' });
        }
      });
    },
  };
}
