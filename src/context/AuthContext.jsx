import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getSession, subscribeAuth, restoreSession, signIn as apiSignIn, signUp as apiSignUp,
  signOut as apiSignOut, setSessionFromTokens, updateUserDisplayName, requestPasswordReset,
  quickSignIn as apiQuickSignIn, signInWithGoogle as apiSignInWithGoogle, isConfigured,
} from '../api/auth';
import { fetchMyProfile } from '../api/profile';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession());
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => subscribeAuth(() => setSession(getSession())), []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchMyProfile()
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfile({ id: session.user.id, role: 'user' }); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [session?.user?.id, session?.access_token]);

  useEffect(() => {
    (async () => {
      // Handle Supabase email/password-reset redirect (tokens in URL hash)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace('#', ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken) {
          try {
            await setSessionFromTokens(accessToken, refreshToken);
            history.replaceState(null, '', window.location.pathname);
            setReady(true);
            return;
          } catch (e) { console.error('Token restore failed:', e); }
        }
      }
      restoreSession();
      setReady(true);
    })();
  }, []);

  const signIn = useCallback((email, pass, remember) => apiSignIn(email, pass, remember), []);
  const quickSignIn = useCallback(() => apiQuickSignIn(), []);
  const signUp = useCallback((email, pass) => apiSignUp(email, pass), []);
  const signOut = useCallback(() => apiSignOut(), []);
  const setDisplayName = useCallback((name) => updateUserDisplayName(name), []);
  const resetPassword = useCallback((email) => requestPasswordReset(email), []);
  const signInWithGoogle = useCallback(() => apiSignInWithGoogle('/login'), []);

  const value = {
    session,
    user: session?.user || null,
    profile,
    isAdmin: profile?.role === 'admin',
    profileLoading,
    isAuthenticated: !!session,
    ready,
    configured: isConfigured(),
    signIn, signUp, signOut, setDisplayName, resetPassword, quickSignIn, signInWithGoogle,
    refreshProfile: async () => {
      const p = await fetchMyProfile();
      setProfile(p);
      return p;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
