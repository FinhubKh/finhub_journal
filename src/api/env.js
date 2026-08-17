/**
 * Client-side config (loaded from root .env via Vite).
 */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const DEFAULT_EA_SYNC_URL = 'https://journal.finhubkh.com/v1/ea/sync';

export const EA_SYNC_ENDPOINT = (
  import.meta.env.VITE_EA_API_URL || DEFAULT_EA_SYNC_URL
).replace(/\/$/, '');

export const EA_WEBREQUEST_ORIGIN = EA_SYNC_ENDPOINT.replace(/\/v1\/ea\/sync$/, '');

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
