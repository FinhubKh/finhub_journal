import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRemembered, clearRemembered } from '../api/auth';
import { btnAuthGoogle, btnAuthSubmit, btnAuthTab, btnText, msgError, msgSuccess } from '../lib/ui';

const PERKS = [
  'Log trades with R-multiples and notes',
  'Review equity curve and win rate stats',
  'Sync closed trades from MT5 automatically',
];

function FieldIcon({ children }) {
  return <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-zinc-300">{children}</span>;
}

function AuthField({ placeholder, type = 'text', value, onChange, autoComplete, icon }) {
  return (
    <div className="relative border-b border-zinc-200 pb-2.5 focus-within:border-violet-500">
      <input
        className="w-full bg-transparent pr-9 text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
      />
      <FieldIcon>{icon}</FieldIcon>
    </div>
  );
}

const iconMail = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const iconLock = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const iconGoogle = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

function AuthDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-zinc-200" />
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">or</span>
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

export default function AuthPage() {
  const { signIn, signUp, resetPassword, quickSignIn, signInWithGoogle, configured } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(() => (searchParams.get('mode') === 'signup' ? 'signup' : 'signin'));
  const [showReset, setShowReset] = useState(false);
  const [remembered, setRemembered] = useState(getRemembered());
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickMsg, setQuickMsg] = useState(null);

  const [siEmail, setSiEmail] = useState('');
  const [siPass, setSiPass] = useState('');
  const [siMsg, setSiMsg] = useState(null);
  const [siLoading, setSiLoading] = useState(false);
  const [siRemember, setSiRemember] = useState(true);

  const [suEmail, setSuEmail] = useState('');
  const [suPass, setSuPass] = useState('');
  const [suPass2, setSuPass2] = useState('');
  const [suMsg, setSuMsg] = useState(null);
  const [suLoading, setSuLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMsg, setGoogleMsg] = useState(null);

  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

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
      setTimeout(() => { setMode('signin'); setShowReset(false); }, 2500);
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

  function handleGoogleSignIn() {
    if (!configured) return setGoogleMsg({ text: 'Add your Supabase keys first.', type: 'error' });
    setGoogleLoading(true);
    setGoogleMsg(null);
    try {
      signInWithGoogle();
    } catch (e) {
      setGoogleMsg({ text: e.message, type: 'error' });
      setGoogleLoading(false);
    }
  }

  const tabBtn = btnAuthTab;

  const submitBtn = btnAuthSubmit;

  const googleBtn = btnAuthGoogle;

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-white px-4 py-10 sm:px-6">
      <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-4xl flex-col items-center justify-center">
        <Link to="/" className="mb-6 self-start text-xs font-semibold uppercase tracking-widest text-zinc-400 transition hover:text-violet-600 sm:self-center">
          Back to home
        </Link>

        <div className="flex w-full overflow-hidden border border-zinc-200 bg-white shadow-sm md:min-h-[520px]">
          {/* Left welcome panel */}
          <aside className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden border-r border-violet-500/30 bg-violet-600 p-10 text-white md:flex">
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(160deg, transparent 40%, rgba(0,0,0,0.25)), url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\' viewBox=\'0 0 200 200\'%3E%3Cpath fill=\'%23ffffff\' fill-opacity=\'0.08\' d=\'M40 160 Q60 120 80 140 T120 130 T160 150 V200 H40Z\'/%3E%3Cpath fill=\'%23ffffff\' fill-opacity=\'0.05\' d=\'M0 180 Q30 150 50 165 T90 155 T130 170 V200 H0Z\'/%3E%3C/svg%3E")',
                backgroundSize: 'cover',
                backgroundPosition: 'bottom',
              }}
              aria-hidden="true"
            />

            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-200">FinhubKH Journal</p>
              <h1 className="mt-8 text-4xl font-bold tracking-tight">Welcome</h1>
              <p className="mt-3 text-sm leading-relaxed text-violet-100">
                Your trading journal is ready. Sign in and pick up where you left off.
              </p>
            </div>

            <ul className="relative space-y-4 text-sm text-violet-50">
              {PERKS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/40 text-[10px]">&#10003;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>

          {/* Right form panel */}
          <div className="flex flex-1 flex-col justify-center px-8 py-10 sm:px-12 md:px-14">
            {!showReset && remembered && (
              <div className="mb-8 rounded-xl border border-violet-100 bg-violet-50/80 p-4 text-center text-sm text-zinc-600">
                <span>Welcome back, <strong className="text-zinc-900">{remembered.email}</strong></span>
                <button type="button" className={`${submitBtn} mt-4 w-full sm:w-auto`} disabled={quickLoading} onClick={handleQuickSignIn}>
                  {quickLoading ? 'Signing in...' : 'Sign in instantly'}
                </button>
                <button type="button" className={btnText} onClick={forgetMe}>Not you? Forget me</button>
                {quickMsg && <p className={`mt-2 ${quickMsg.type === 'error' ? msgError : msgSuccess}`}>{quickMsg.text}</p>}
              </div>
            )}

            {!showReset ? (
              <>
                <div className="mb-10 text-center">
                  <button type="button" className={tabBtn(mode === 'signin')} onClick={() => setMode('signin')}>Login</button>
                  <span className="mx-2 text-lg text-zinc-300">/</span>
                  <button type="button" className={tabBtn(mode === 'signup')} onClick={() => setMode('signup')}>Sign Up</button>
                </div>

                {mode === 'signin' && (
                  <div className="space-y-7">
                    <AuthField
                      placeholder="Email"
                      type="email"
                      autoComplete="email"
                      value={siEmail}
                      onChange={(e) => setSiEmail(e.target.value)}
                      icon={iconMail}
                    />
                    <AuthField
                      placeholder="Password"
                      type="password"
                      autoComplete="current-password"
                      value={siPass}
                      onChange={(e) => setSiPass(e.target.value)}
                      icon={iconLock}
                    />
                    <label className="flex items-center gap-2 text-sm text-zinc-500">
                      <input type="checkbox" className="accent-violet-600" checked={siRemember} onChange={(e) => setSiRemember(e.target.checked)} />
                      Remember me
                    </label>
                    <div className="pt-2">
                      <button type="button" className={submitBtn} disabled={siLoading} onClick={handleSignIn}>
                        {siLoading ? 'Signing in...' : 'Login'}
                      </button>
                    </div>
                    {siMsg && <p className={siMsg.type === 'error' ? msgError : msgSuccess}>{siMsg.text}</p>}
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-7">
                    <button type="button" className={googleBtn} disabled={googleLoading} onClick={handleGoogleSignIn}>
                      {iconGoogle}
                      {googleLoading ? 'Redirecting...' : 'Continue with Google'}
                    </button>
                    <AuthDivider />
                    <AuthField
                      placeholder="Email"
                      type="email"
                      autoComplete="email"
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                      icon={iconMail}
                    />
                    <AuthField
                      placeholder="Password"
                      type="password"
                      autoComplete="new-password"
                      value={suPass}
                      onChange={(e) => setSuPass(e.target.value)}
                      icon={iconLock}
                    />
                    <AuthField
                      placeholder="Confirm password"
                      type="password"
                      autoComplete="new-password"
                      value={suPass2}
                      onChange={(e) => setSuPass2(e.target.value)}
                      icon={iconLock}
                    />
                    <div className="pt-2">
                      <button type="button" className={submitBtn} disabled={suLoading} onClick={handleSignUp}>
                        {suLoading ? 'Creating...' : 'Sign Up'}
                      </button>
                    </div>
                    {suMsg && <p className={suMsg.type === 'error' ? msgError : msgSuccess}>{suMsg.text}</p>}
                    {googleMsg && <p className={googleMsg.type === 'error' ? msgError : msgSuccess}>{googleMsg.text}</p>}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-7">
                <div className="mb-4 text-center">
                  <h2 className="text-xl font-bold text-zinc-900">Reset password</h2>
                  <p className="mt-2 text-sm text-zinc-500">Enter your email and we will send a reset link.</p>
                </div>
                <AuthField
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  icon={iconMail}
                />
                <button type="button" className={submitBtn} disabled={resetLoading} onClick={handleReset}>
                  {resetLoading ? 'Sending...' : 'Send link'}
                </button>
                {resetMsg && <p className={resetMsg.type === 'error' ? msgError : msgSuccess}>{resetMsg.text}</p>}
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-400">
          {!showReset ? (
            <>
              {mode === 'signin' ? (
                <>
                  Don&apos;t have an{' '}
                  <button type="button" className={btnText} onClick={() => setMode('signup')}>account?</button>
                  {' '}/{' '}
                  <button type="button" className={btnText} onClick={() => setShowReset(true)}>Forgot password?</button>
                </>
              ) : (
                <>
                  Already have an{' '}
                  <button type="button" className={btnText} onClick={() => setMode('signin')}>account?</button>
                  {' '}— sign in instead.
                </>
              )}
            </>
          ) : (
            <button type="button" className={btnText} onClick={() => setShowReset(false)}>Back to login</button>
          )}
        </p>
      </div>
    </div>
  );
}
