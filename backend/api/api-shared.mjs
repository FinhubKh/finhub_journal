/**
 * Request helpers shared by the backend API handlers.
 */

const DEFAULT_MODEL = 'aisingapore/Qwen-SEA-LION-v4.5-27B-IT';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export async function verifySupabaseUser({ supabaseUrl, anonKey, accessToken }) {
  if (!accessToken) {
    return { ok: false, status: 401, error: 'Missing authorization' };
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const user = await res.json();
  if (!user?.id) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, user };
}

export { readJsonBody, DEFAULT_MODEL };
