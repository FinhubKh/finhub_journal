import { SUPABASE_URL, authFetch, authHeaders, getToken, getUserId } from './auth';

export async function fetchMyProfile() {
  const userId = getUserId();
  if (!userId) return null;

  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,email,display_name,role,created_at&id=eq.${userId}&limit=1`,
    { headers: authHeaders(getToken()) },
  );
  if (res.status === 404) return { id: userId, role: 'user' };
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0] || { id: userId, role: 'user' };
}
