import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRemembered, clearRemembered } from '../api/auth';

export default function AuthPage() {
  const { signIn, signUp, resetPassword, quickSignIn, configured } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [showReset, setShowReset] = useState(false);
  const [remembered, setRemembered] = useState(getRemembered());
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickMsg, setQuickMsg] = useState(null);

  const [siEmail, setSiEmail] = useState('');
  const [siPass, setSiPass] = useState('');
  const [siMsg, setSiMsg] = useState(null);
  const [siLoading, setSiLoading] = useState(false);
  const [siRemember, setSiRemember] = useState(true);

  async function handleQuickSignIn() {
    setQuickLoading(true); setQuickMsg(null);
    try { await quickSignIn(); }
    catch (e) { setQuickMsg({ text: e.message, type: 'error' }); setRemembered(null); }
    finally { setQuickLoading(false); }
  }

  function forgetMe() {
    clearRemembered();
    setRemembered(null);
  }

  const [suEmail, setSuEmail] = useState('');
  const [suPass, setSuPass] = useState('');
  const [suPass2, setSuPass2] = useState('');
  const [suMsg, setSuMsg] = useState(null);
  const [suLoading, setSuLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSignIn() {
    if (!siEmail || !siPass) return setSiMsg({ text: 'Please fill in all fields.', type: 'error' });
    if (!configured) return setSiMsg({ text: 'Add your Supabase keys first.', type: 'error' });
    setSiLoading(true); setSiMsg(null);
    try { await signIn(siEmail.trim(), siPass, siRemember); }
    catch (e) { setSiMsg({ text: e.message, type: 'error' }); }
    finally { setSiLoading(false); }
  }

  async function handleSignUp() {
    if (!suEmail || !suPass || !suPass2) return setSuMsg({ text: 'Please fill in all fields.', type: 'error' });
    if (suPass !== suPass2) return setSuMsg({ text: 'Passwords do not match.', type: 'error' });
    if (suPass.length < 6) return setSuMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
    if (!configured) return setSuMsg({ text: 'Add your Supabase keys first.', type: 'error' });
    setSuLoading(true); setSuMsg(null);
    try {
      await signUp(suEmail.trim(), suPass);
      setSuMsg({ text: 'Account created! Check your email to confirm, then sign in.', type: 'success' });
      setTimeout(() => setMode('signin'), 2500);
    } catch (e) { setSuMsg({ text: e.message, type: 'error' }); }
    finally { setSuLoading(false); }
  }

  async function handleReset() {
    if (!resetEmail) return setResetMsg({ text: 'Please enter your email.', type: 'error' });
    setResetLoading(true); setResetMsg(null);
    try {
      await resetPassword(resetEmail.trim());
      setResetMsg({ text: 'Reset link sent! Check your inbox.', type: 'success' });
    } catch (e) { setResetMsg({ text: e.message, type: 'error' }); }
    finally { setResetLoading(false); }
  }

  return (
    <div className="auth-screen" id="auth-screen">
      <div className="auth-box">
        <div className="auth-logo">FinhubKH</div>
        <div className="auth-tagline">Journal</div>

        {!showReset && remembered && (
          <div className="auth-remember-banner">
            <span>Welcome back, <strong>{remembered.email}</strong></span>
            <button className="auth-btn" disabled={quickLoading} onClick={handleQuickSignIn} style={{ marginTop: 8 }}>
              {quickLoading ? 'Signing in...' : 'Sign In Instantly'}
            </button>
            <button className="auth-link-btn" onClick={forgetMe}>Not you? Forget me</button>
            {quickMsg && <div className={`auth-msg ${quickMsg.type}`}>{quickMsg.text}</div>}
          </div>
        )}

        {!showReset ? (
          <div id="auth-signin-signup">
            <div className="auth-tabs">
              <button className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')}>Sign In</button>
              <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>Sign Up</button>
            </div>

            {mode === 'signin' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="you@email.com" autoComplete="email"
                    value={siEmail} onChange={(e) => setSiEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" placeholder="••••••••" autoComplete="current-password"
                    value={siPass} onChange={(e) => setSiPass(e.target.value)} />
                </div>
                <label className="auth-remember-check">
                  <input type="checkbox" checked={siRemember} onChange={(e) => setSiRemember(e.target.checked)} />
                  <span>Remember Me</span>
                </label>
                <button className="auth-btn" disabled={siLoading} onClick={handleSignIn}>{siLoading ? 'Signing in...' : 'Sign In'}</button>
                <button className="auth-link-btn" onClick={() => setShowReset(true)}>Forgot password?</button>
                {siMsg && <div className={`auth-msg ${siMsg.type}`}>{siMsg.text}</div>}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="you@email.com" autoComplete="email"
                    value={suEmail} onChange={(e) => setSuEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" placeholder="Min. 6 characters" autoComplete="new-password"
                    value={suPass} onChange={(e) => setSuPass(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Confirm Password</label>
                  <input className="form-input" type="password" placeholder="••••••••" autoComplete="new-password"
                    value={suPass2} onChange={(e) => setSuPass2(e.target.value)} />
                </div>
                <button className="auth-btn" disabled={suLoading} onClick={handleSignUp}>{suLoading ? 'Creating account...' : 'Create Account'}</button>
                {suMsg && <div className={`auth-msg ${suMsg.type}`}>{suMsg.text}</div>}
              </div>
            )}
          </div>
        ) : (
          <div id="auth-reset">
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, color: 'var(--text2)' }}>Reset Password</div>
              <div style={{ fontSize: 12, fontWeight: 300, color: 'var(--text4)', marginTop: 4, lineHeight: 1.5 }}>Enter your email and we'll send a reset link.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@email.com" autoComplete="email"
                value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
            </div>
            <button className="auth-btn" disabled={resetLoading} onClick={handleReset}>{resetLoading ? 'Sending...' : 'Send Reset Link'}</button>
            <button className="auth-link-btn" onClick={() => setShowReset(false)}>← Back to Sign In</button>
            {resetMsg && <div className={`auth-msg ${resetMsg.type}`}>{resetMsg.text}</div>}
          </div>
        )}

        <p className="auth-footer-note">Your data is private and synced across all your devices.</p>
      </div>
    </div>
  );
}
