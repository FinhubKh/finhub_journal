import { EA_WEBREQUEST_ORIGIN } from './env';

function resolveMarketApiBase() {
  if (import.meta.env.VITE_MARKET_API_URL) {
    return import.meta.env.VITE_MARKET_API_URL.replace(/\/$/, '');
  }
  // Same-origin via Vite/Vercel rewrites (avoids CORS on custom domains).
  return '';
}

const MARKET_API_BASE = resolveMarketApiBase();

async function marketFetch(path) {
  const res = await fetch(`${MARKET_API_BASE}${path}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return res.json();
}

export function fetchEconomicCalendar() {
  return marketFetch('/v1/market/economic-calendar');
}

export function fetchMarketNews(limit = 40) {
  return marketFetch(`/v1/market/news?limit=${encodeURIComponent(limit)}`);
}
