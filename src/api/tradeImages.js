/**
 * Manual trade screenshots via Supabase Storage + trade_images table.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, authHeaders, getToken, getUserId, authFetch } from './auth';

const BUCKET = 'trade-screenshots';
const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extFromType(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

export function validateTradeImageFile(file) {
  if (!file) throw new Error('No file selected');
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Use JPG, PNG, WEBP, or GIF');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be under 5MB');
  }
}

export async function fetchTradeImages(tradeId) {
  const res = await authFetch(
    `${SUPABASE_URL}/rest/v1/trade_images?select=*&trade_id=eq.${tradeId}&order=created_at.asc`,
    { headers: authHeaders(getToken()) },
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(await res.text());
  }
  return res.json();
}

export async function createSignedImageUrl(storagePath, expiresIn = 3600) {
  const res = await authFetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: authHeaders(getToken()),
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const signed = data?.signedURL || data?.signedUrl || data?.url;
  if (!signed) throw new Error('Could not create image URL');
  if (signed.startsWith('http')) return signed;
  return `${SUPABASE_URL}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`;
}

export async function fetchTradeImagesWithUrls(tradeId) {
  const rows = await fetchTradeImages(tradeId);
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      try {
        const url = await createSignedImageUrl(row.storage_path);
        return { ...row, url };
      } catch {
        return { ...row, url: null };
      }
    }),
  );
  return withUrls;
}

export async function uploadTradeImage(tradeId, file, label = 'Entry') {
  validateTradeImageFile(file);
  const userId = getUserId();
  if (!userId) throw new Error('Not signed in');

  const existing = await fetchTradeImages(tradeId);
  if (existing.length >= MAX_IMAGES) {
    throw new Error(`Maximum ${MAX_IMAGES} screenshots per trade`);
  }

  const safeLabel = ['Entry', 'HTF', 'Exit', 'Other'].includes(label) ? label : 'Entry';
  const id = crypto.randomUUID();
  const ext = extFromType(file.type);
  const storagePath = `${userId}/${tradeId}/${id}.${ext}`;

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': file.type,
        'x-upsert': 'false',
      },
      body: file,
    },
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(text || 'Upload failed');
  }

  const insertRes = await authFetch(`${SUPABASE_URL}/rest/v1/trade_images`, {
    method: 'POST',
    headers: { ...authHeaders(getToken()), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      trade_id: tradeId,
      storage_path: storagePath,
      label: safeLabel,
      file_name: file.name || `screenshot.${ext}`,
      content_type: file.type,
    }),
  });
  if (!insertRes.ok) {
    // Best-effort cleanup if DB insert fails
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${getToken()}`,
      },
    }).catch(() => {});
    throw new Error(await insertRes.text());
  }

  const [row] = await insertRes.json();
  const url = await createSignedImageUrl(storagePath);
  return { ...row, url };
}

export async function deleteTradeImage(image) {
  if (!image?.id || !image?.storage_path) throw new Error('Invalid image');

  const delRes = await authFetch(`${SUPABASE_URL}/rest/v1/trade_images?id=eq.${image.id}`, {
    method: 'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!delRes.ok) throw new Error(await delRes.text());

  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${image.storage_path}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${getToken()}`,
    },
  }).catch(() => {});
}

export async function deleteAllTradeImages(tradeId) {
  const rows = await fetchTradeImages(tradeId);
  for (const row of rows) {
    await deleteTradeImage(row).catch(() => {});
  }
}

export { MAX_IMAGES };
