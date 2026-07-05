/**
 * nXuu — auth.js
 * Supabase auth (REST) + session singleton with a tiny pub/sub so
 * React can subscribe to session changes via useSyncExternalStore.
 */

export const SUPABASE_URL = 'https://jlcgfogamjjgsieatuxi.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY2dmb2dhbWpqZ3NpZWF0dXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3OTAxNTksImV4cCI6MjA5ODM2NjE1OX0.ce3FUHEm6Uor98iLCM6Y7wt-NCNsWERUOmOZQkgPflo';

export function isConfigured() {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

function persistSession() {
  const store = sessionStorage.getItem('nxuu_session') ? sessionStorage : localStorage;
  store.setItem('nxuu_session', JSON.stringify(_session));
}

let _session = null;
const listeners = new Set();
function notify() {
  listeners.forEach((fn) => fn());
}
export function subscribeAuth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSession() { return _session; }
export function getToken() { return _session?.access_token || SUPABASE_ANON_KEY; }
export function getUserId() { return _session?.user?.id || null; }
export function getUserEmail() { return _session?.user?.email || ''; }
export function getUserDisplayName() { return _session?.user?.user_metadata?.display_name || ''; }

export async function updateUserDisplayName(name) {
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
    _session.user.user_metadata = updated.user_metadata;
    localStorage.setItem('nxuu_session', JSON.stringify(_session));
    notify();
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
  localStorage.removeItem('nxuu_session');
  sessionStorage.removeItem('nxuu_session');
  _session = data;
  sessionStorage.setItem('nxuu_session', JSON.stringify(data));
  if (remember) {
    localStorage.setItem('nxuu_remember', JSON.stringify({ email, refresh_token: data.refresh_token }));
  } else {
    localStorage.removeItem('nxuu_remember');
  }
  notify();
  return data;
}

// "Remember Me" — stored separately from the active session so the app
// always lands on the login screen, but the user can relogin in one tap.
export function getRemembered() {
  try { return JSON.parse(localStorage.getItem('nxuu_remember') || 'null'); }
  catch (e) { return null; }
}

export function clearRemembered() {
  localStorage.removeItem('nxuu_remember');
}

export async function quickSignIn() {
  const rem = getRemembered();
  if (!rem?.refresh_token) throw new Error('No remembered session.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: rem.refresh_token }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    clearRemembered();
    throw new Error('Session expired, please sign in again.');
  }
  _session = data;
  sessionStorage.setItem('nxuu_session', JSON.stringify(data));
  localStorage.setItem('nxuu_remember', JSON.stringify({ email: rem.email, refresh_token: data.refresh_token }));
  notify();
  return data;
}

export async function refreshSession() {
  if (!_session?.refresh_token) throw new Error('No refresh token');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: _session.refresh_token }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('Refresh failed');
  _session = { ..._session, access_token: data.access_token, refresh_token: data.refresh_token };
  localStorage.setItem('nxuu_session', JSON.stringify(_session));
  notify();
  return _session;
}

export async function authFetch(url, options = {}) {
  let res = await fetch(url, options);
  if (res.status === 401 && _session?.refresh_token) {
    try {
      await refreshSession();
      const retryOptions = { ...options, headers: { ...options.headers, Authorization: `Bearer ${getToken()}` } };
      res = await fetch(url, retryOptions);
    } catch (e) { /* refresh failed, return original 401 */ }
  }
  return res;
}

export async function signOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: authHeaders(getToken()) });
  } catch (e) { /* ignore */ }
  _session = null;
  localStorage.removeItem('nxuu_session');
  sessionStorage.removeItem('nxuu_session');
  notify();
}

export function restoreSession() {
  // Only restore from sessionStorage (same browser session). This means
  // reopening the site (new browser session) always lands on the login page.
  localStorage.removeItem('nxuu_session');
  try {
    const raw = sessionStorage.getItem('nxuu_session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.access_token || !s?.user?.id || !s?.user?.email) {
      localStorage.removeItem('nxuu_session');
      sessionStorage.removeItem('nxuu_session');
      return false;
    }
    _session = s;
    notify();
    return true;
  } catch (e) {
    localStorage.removeItem('nxuu_session');
    sessionStorage.removeItem('nxuu_session');
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
  const session = { access_token: accessToken, refresh_token: refreshToken, user };
  _session = session;
  localStorage.setItem('nxuu_session', JSON.stringify(session));
  notify();
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