import { fetchMarketNews } from '../../../backend/api/market-handler.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const limit = req.query?.limit;
    const data = await fetchMarketNews(limit);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to load market news' });
  }
}
