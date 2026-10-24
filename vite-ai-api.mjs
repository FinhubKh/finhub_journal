import { loadEnv } from './backend/api/load-env.mjs';
import {
  handlePerformanceInsights,
  handlePerformanceReport,
  handlePerformanceAnalyze,
  handlePerformanceChat,
  handlePerformanceStats,
  handleListPerformanceReports,
  handleDeletePerformanceReport,
  handleGetChatHistory,
  handleClearChatHistory,
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
    embedFunctionSecret: (env.EMBED_FUNCTION_SECRET || '').trim(),
  };
}

export function aiDevApiPlugin() {
  return {
    name: 'finhub-ai-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (!pathname.startsWith('/v1/ai/performance/')) return next();

        const env = loadEnv();
        const deps = performanceDeps(env);

        if (!deps.supabaseUrl || !deps.anonKey) {
          sendJson(res, 500, { error: 'Supabase is not configured' });
          return;
        }

        try {
          let result;
          if (pathname === '/v1/ai/performance/insights' && req.method === 'POST') {
            result = await handlePerformanceInsights(req, deps);
          } else if (pathname === '/v1/ai/performance/report' && req.method === 'POST') {
            result = await handlePerformanceReport(req, deps);
          } else if (pathname === '/v1/ai/performance/analyze' && req.method === 'POST') {
            result = await handlePerformanceAnalyze(req, deps);
          } else if (pathname === '/v1/ai/performance/chat' && req.method === 'POST') {
            result = await handlePerformanceChat(req, deps);
          } else if (pathname === '/v1/ai/performance/stats' && req.method === 'POST') {
            result = await handlePerformanceStats(req, deps);
          } else if (pathname === '/v1/ai/performance/chat/history' && req.method === 'GET') {
            result = await handleGetChatHistory(req, deps);
          } else if (pathname === '/v1/ai/performance/chat/history' && req.method === 'DELETE') {
            result = await handleClearChatHistory(req, deps);
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
