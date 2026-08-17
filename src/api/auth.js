/**
 * nXuu — auth.js
 * Supabase auth (REST) + session singleton with a tiny pub/sub so
 * React can subscribe to session changes via useSyncExternalStore.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './env';

export { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured };

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

let _session = null;
let _refreshPromise = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function normalizeSession(data, prev = null) {
  if (!data?.access_token) return null;
  const expiresIn = Number(data.expires_in);
  const expiresAt =
    data.expires_at ||
    (Number.isFinite(expiresIn)
      ? Math.floor(Date.now() / 1000) + expiresIn
      : prev?.expires_at || null);

  return {
    ...prev,
    ...data,
    access_token: data.access_token,
    refresh_token: data.refresh_token || prev?.refresh_token || null,
    user: data.user || prev?.user || null,
    expires_at: expiresAt,
  };
}

/** Active session in sessionStorage; remembered sessions also mirror to localStorage (no separate refresh blob). */
function persistSession() {
  if (!_session) {
    sessionStorage.removeItem('nxuu_session');
    if (!_rememberPreferred && !readRememberPreferred()) {
      localStorage.removeItem('nxuu_session');
    }
    return;
  }
  const raw = JSON.stringify(_session);
  sessionStorage.setItem('nxuu_session', raw);
  if (_rememberPreferred || readRememberPreferred()) {
    localStorage.setItem('nxuu_session', raw);
  }
}

function clearSessionStorage() {
  localStorage.removeItem('nxuu_session');
  sessionStorage.removeItem('nxuu_session');
}

export function getSession() { return _session; }
export function getToken() { return _session?.access_token || SUPABASE_ANON_KEY; }
export function getUserId() { return _session?.user?.id || null; }
export function getUserEmail() { return _session?.user?.email || ''; }
export function getUserDisplayName() { return _session?.user?.user_metadata?.display_name || ''; }

let _rememberPreferred = false;

function readRememberPreferred() {
  try {
    return Boolean(JSON.parse(localStorage.getItem('nxuu_remember') || 'null')?.email);
  } catch {
    return false;
  }
}

function secondsUntilExpiry() {
  if (!_session?.expires_at) return null;
  return _session.expires_at - Math.floor(Date.now() / 1000);
}

export async function updateUserDisplayName(name) {
  await ensureFreshSession();
  const userId = getUserId();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: authHeaders(getToken()),
    body: JSON.stringify({ data: { display_name: name } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || data.error_description || 'Could not update display name.');
  }
  const updated = await res.json();
  if (_session && updated?.user_metadata) {
    _session = { ..._session, user: { ..._session.user, user_metadata: updated.user_metadata } };
    persistSession();
    notify();
  }

  if (userId) {
    try {
      await authFetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...authHeaders(getToken()),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: userId,
          email: getUserEmail(),
          display_name: name,
        }),
      });
    } catch (e) {
      console.warn('Could not sync display_name to profiles table:', e);
    }
  }

  return updated;
}

export async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || data.error || data.error_code || data.msg) {
    throw new Error(data.error_description || data.msg || data.error?.message || data.error || 'Sign up failed');
  }
  if (data.access_token) {
    clearSessionStorage();
    _rememberPreferred = false;
    _session = normalizeSession(data);
    persistSession();
    notify();
  }
  return data;
}

export async function signIn(email, password, remember = false) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || data.error || data.error_code || data.msg || !data.access_token) {
    throw new Error(data.error_description || data.msg || data.error || 'Invalid email or password.');
  }
  clearSessionStorage();
  _rememberPreferred = Boolean(remember);
  _session = normalizeSession(data);
  if (remember) {
    localStorage.setItem('nxuu_remember', JSON.stringify({ email }));
  } else {
    localStorage.removeItem('nxuu_remember');
    localStorage.removeItem('nxuu_session');
  }
  persistSession();
  notify();
  return _session;
}

// "Remember Me" stores email only (for prefilling). Session lives in localStorage when remembered.
export function getRemembered() {
  try {
    const rem = JSON.parse(localStorage.getItem('nxuu_remember') || 'null');
    if (!rem?.email) return null;
    return { email: rem.email };
  } catch (e) { return null; }
}

export function clearRemembered() {
  localStorage.removeItem('nxuu_remember');
  localStorage.removeItem('nxuu_session');
  _rememberPreferred = false;
}

/** Prefer restoring a remembered localStorage session; otherwise ask the user to sign in. */
export async function quickSignIn() {
  const rem = getRemembered();
  if (!rem?.email) throw new Error('No remembered session.');
  _rememberPreferred = true;
  const raw = localStorage.getItem('nxuu_session');
  if (!raw) throw new Error('Session expired, please sign in again.');
  const s = JSON.parse(raw);
  if (!s?.access_token || !s?.refresh_token) {
    clearRemembered();
    throw new Error('Session expired, please sign in again.');
  }
  _session = normalizeSession(s);
  persistSession();
  try {
    await ensureFreshSession({ force: true });
  } catch {
    clearRemembered();
    await forceSignOutLocal();
    throw new Error('Session expired, please sign in again.');
  }
  notify();
  return _session;
}

export async function refreshSession() {
  if (!_session?.refresh_token) throw new Error('No refresh token');

  // Deduplicate concurrent refreshes (many API calls can 401 at once).
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: _session.refresh_token }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(data.msg || data.error_description || 'Refresh failed');
    }
    _session = normalizeSession(data, _session);
    persistSession();
    notify();
    return _session;
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
}

/** Refresh if access token is missing expiry info, expired, or about to expire. */
export async function ensureFreshSession({ force = false } = {}) {
  if (!_session?.access_token) return null;
  const left = secondsUntilExpiry();
  if (!force && left != null && left > 60) return _session;
  if (!_session.refresh_token) throw new Error('Session expired');
  return refreshSession();
}

function mergeAuthHeader(options, token) {
  const headers = { ...(options.headers || {}) };
  headers.Authorization = `Bearer ${token}`;
  if (!headers.apikey && !headers.Apikey) headers.apikey = SUPABASE_ANON_KEY;
  return { ...options, headers };
}

async function looksLikeJwtExpired(res) {
  if (res.status !== 401) return false;
  try {
    const data = await res.clone().json();
    const msg = String(data?.message || data?.msg || data?.error_description || '');
    return data?.code === 'PGRST303' || /jwt expired|invalid jwt|token.*expired/i.test(msg);
  } catch {
    return false;
  }
}

export async function authFetch(url, options = {}) {
  try {
    await ensureFreshSession();
  } catch {
    /* continue; request may still work or surface auth error */
  }

  let res = await fetch(url, mergeAuthHeader(options, getToken()));

  if ((await looksLikeJwtExpired(res)) && _session?.refresh_token) {
    try {
      await refreshSession();
      res = await fetch(url, mergeAuthHeader(options, getToken()));
    } catch {
      await forceSignOutLocal();
    }
  }

  return res;
}

async function forceSignOutLocal() {
  _session = null;
  clearSessionStorage();
  notify();
}

export async function signOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: authHeaders(getToken()) });
  } catch (e) { /* ignore */ }
  await forceSignOutLocal();
}

export function restoreSession() {
  try {
    const raw = sessionStorage.getItem('nxuu_session') || localStorage.getItem('nxuu_session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.access_token || !s?.user?.id || !s?.user?.email) {
      clearSessionStorage();
      return false;
    }
    _rememberPreferred = readRememberPreferred();
    _session = normalizeSession(s);
    persistSession();
    notify();
    return true;
  } catch (e) {
    clearSessionStorage();
    return false;
  }
}

/** Restore session then refresh token if it already expired while the tab was open. */
export async function restoreSessionAndRefresh() {
  const ok = restoreSession();
  if (!ok) return false;
  try {
    const left = secondsUntilExpiry();
    await ensureFreshSession({ force: left == null || left <= 0 });
    return !!_session;
  } catch {
    await forceSignOutLocal();
    return false;
  }
}

export async function setSessionFromTokens(accessToken, refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not verify token');
  const user = await res.json();
  if (!user?.id) throw new Error('Invalid user from token');
  _session = normalizeSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    user,
    expires_in: 3600,
  });
  localStorage.removeItem('nxuu_session');
  persistSession();
  notify();
}

export function signInWithGoogle(redirectPath = '/login') {
  if (!isConfigured()) throw new Error('Add your Supabase keys first.');
  const redirectTo = `${window.location.origin}${redirectPath}`;
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
  });
  window.location.assign(`${SUPABASE_URL}/auth/v1/authorize?${params}`);
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.msg || data.error_description || 'Could not send reset email.');
  }
}
