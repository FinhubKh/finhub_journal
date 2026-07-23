import { loadEnv } from './backend/api/load-env.mjs';
import { handleAiChecklistRequest } from './backend/api/ai-checklist-handler.mjs';
import {
  handlePerformanceInsights,
  handlePerformanceReport,
  handlePerformanceAnalyze,
  handlePerformanceChat,
  handleListPerformanceReports,
  handleDeletePerformanceReport,
} from './backend/api/ai-performance-handler.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function performanceDeps(env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL?.replace(/\/$/, ''),
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    sealionApiKey: (env.SEALION_API_KEY || '').trim(),
    model: (env.SEALION_MODEL || '').trim() || undefined,
  };
}

export function aiDevApiPlugin() {
  return {
    name: 'finhub-ai-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        const isChecklist = pathname === '/v1/ai/checklist';
        const isPerf = pathname.startsWith('/v1/ai/performance/');
        if (!isChecklist && !isPerf) return next();

        const env = loadEnv();
        const deps = performanceDeps(env);

        if (!deps.supabaseUrl || !deps.anonKey) {
          sendJson(res, 500, { error: 'Supabase is not configured' });
          return;
        }

        try {
          if (isChecklist) {
            if (req.method !== 'POST') {
              sendJson(res, 405, { error: 'Method not allowed' });
              return;
            }
            const result = await handleAiChecklistRequest(req, {
              supabaseUrl: deps.supabaseUrl,
              anonKey: deps.anonKey,
              sealionApiKey: deps.sealionApiKey,
              model: deps.model,
            });
            sendJson(res, result.status, result.body);
            return;
          }

          let result;
          if (pathname === '/v1/ai/performance/insights' && req.method === 'POST') {
            result = await handlePerformanceInsights(req, deps);
          } else if (pathname === '/v1/ai/performance/report' && req.method === 'POST') {
            result = await handlePerformanceReport(req, deps);
          } else if (pathname === '/v1/ai/performance/analyze' && req.method === 'POST') {
            result = await handlePerformanceAnalyze(req, deps);
          } else if (pathname === '/v1/ai/performance/chat' && req.method === 'POST') {
            result = await handlePerformanceChat(req, deps);
          } else if (pathname === '/v1/ai/performance/reports' && req.method === 'GET') {
            result = await handleListPerformanceReports(req, deps);
          } else if (pathname === '/v1/ai/performance/reports' && req.method === 'DELETE') {
            result = await handleDeletePerformanceReport(req, deps);
          } else {
            sendJson(res, 405, { error: 'Method not allowed' });
            return;
          }
          sendJson(res, result.status, result.body);
        } catch (err) {
          sendJson(res, 500, { error: err.message || 'AI request failed' });
        }
      });
    },
  };
}
