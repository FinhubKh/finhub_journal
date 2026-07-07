import { fetchEconomicCalendar, fetchMarketNews } from './backend/api/market-handler.mjs';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function marketDevApiPlugin() {
  return {
    name: 'finhub-market-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (!pathname.startsWith('/v1/market/')) return next();

        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          if (pathname === '/v1/market/economic-calendar') {
            const data = await fetchEconomicCalendar();
            sendJson(res, 200, data);
            return;
          }

          if (pathname === '/v1/market/news') {
            const limit = new URL(req.url, 'http://localhost').searchParams.get('limit');
            const data = await fetchMarketNews(limit);
            sendJson(res, 200, data);
            return;
          }

          sendJson(res, 404, { error: 'Not found' });
        } catch (err) {
          sendJson(res, 502, { error: err.message || 'Market data unavailable' });
        }
      });
    },
  };
}
