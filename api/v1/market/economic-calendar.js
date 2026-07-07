import { fetchEconomicCalendar } from '../../../backend/api/market-handler.mjs';

export default async function handler(_req, res) {
  if (_req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const data = await fetchEconomicCalendar();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to load economic calendar' });
  }
}
