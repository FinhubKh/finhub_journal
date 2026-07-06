import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, btnPrimaryLg, btnOutline, pageShell } from '../lib/ui';

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

const PLATFORM_TOOLS = [
  { title: 'Automated journaling', desc: 'Sync MT5 trades on terminal start. No manual copy-paste.' },
  { title: 'Deep analytics', desc: 'Win rate, profit factor, expectancy, and R-multiple in one view.' },
  { title: 'Session discipline', desc: 'Pre-trade checklist keeps your process consistent every day.' },
  { title: 'Calendar review', desc: 'See winning and losing days at a glance across months and years.' },
];

const FEATURE_SECTIONS = [
  {
    id: 'journal',
    tag: 'Trade log',
    title: 'Log every trade with context that actually matters',
    desc: 'Capture result, R-multiple, session, model, and notes in seconds. Filter by account, date, or setup so reviews stay focused.',
    bullets: ['Manual logging with smart defaults', 'Account-level filtering', 'Edit and review any past trade'],
    mock: 'journal',
  },
  {
    id: 'analytics',
    tag: 'Analytics',
    title: 'See what is driving profits and what is costing you',
    desc: 'Equity curve, breakdown by model and session, and overview tiles update as soon as trades are logged or synced.',
    bullets: ['Equity curve in $ or R', 'Breakdown pie charts', 'Win rate, PF, and expectancy'],
    mock: 'analytics',
    reverse: true,
  },
  {
    id: 'calendar',
    tag: 'Calendar',
    title: 'Spot your best days and worst habits at a glance',
    desc: 'Monthly and yearly calendar views color-code PnL so you can see streaks, drawdown periods, and consistency over time.',
    bullets: ['Daily PnL on each cell', 'Month and year toggle', 'Session summary stats'],
    mock: 'calendar',
  },
  {
    id: 'checklist',
    tag: 'Checklist',
    title: 'Run your process before every session',
    desc: 'Custom checklist steps you define once and run every day. Build the discipline habit without opening another app.',
    bullets: ['Fully custom steps', 'Progress tracking per session', 'Stays synced across devices'],
    mock: 'checklist',
    reverse: true,
  },
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Sign up free and set your display name, models, and checklist steps.' },
  { n: '02', title: 'Log or sync trades', desc: 'Add trades manually or connect the MT5 EA to import closed history automatically.' },
  { n: '03', title: 'Review and improve', desc: 'Use overview, calendar, and breakdown reports to refine your edge every week.' },
];

const FAQS = [
  { q: 'Is FinhubKH Journal free?', a: 'Yes. Create an account and start journaling at no cost. Your data is private to your account.' },
  { q: 'How does MT5 sync work?', a: 'Generate a sync key in Settings, paste it into the FinhubKH EA, and your closed trades import when you start MT5.' },
  { q: 'Can I use multiple accounts?', a: 'Yes. Tag trades by account and filter the entire journal by account from the sidebar.' },
  { q: 'Is my data shared publicly?', a: 'No. Your trades and stats are private to your account only.' },
];

function MockJournal() {
  const rows = [
    { sym: 'XAUUSD', r: '+2.0R', pnl: '+$240', res: 'win' },
    { sym: 'NAS100', r: '-1.0R', pnl: '-$120', res: 'loss' },
    { sym: 'EURUSD', r: '+1.5R', pnl: '+$180', res: 'win' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-violet-500/10">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <span className="text-xs font-semibold text-zinc-500">Recent trades</span>
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">Live</span>
      </div>
      <div className="divide-y divide-zinc-100">
        {rows.map((r) => (
          <div key={r.sym} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900">{r.sym}</div>
              <div className="text-xs text-zinc-400">London · Model A</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold ${r.res === 'win' ? 'text-emerald-600' : 'text-rose-500'}`}>{r.pnl}</div>
              <div className="text-xs text-zinc-400">{r.r}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockAnalytics() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-500/10">
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Net PnL', v: '+$1,240', c: 'text-emerald-600' },
          { l: 'Win rate', v: '62%', c: 'text-violet-600' },
          { l: 'Profit factor', v: '1.84', c: 'text-zinc-900' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-zinc-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{s.l}</div>
            <div className={`mt-1 text-lg font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-zinc-50 p-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Equity curve</div>
        <svg viewBox="0 0 280 80" className="h-20 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 60 L40 55 L80 48 L120 52 L160 35 L200 30 L240 22 L280 15 L280 80 L0 80 Z" fill="url(#eq)" />
          <path d="M0 60 L40 55 L80 48 L120 52 L160 35 L200 30 L240 22 L280 15" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function MockCalendar() {
  const cells = ['', '', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
  const tones = ['', '', 'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-600', 'bg-emerald-100 text-emerald-700', '', 'bg-emerald-50 text-emerald-600', 'bg-rose-50 text-rose-500', '', 'bg-emerald-100 text-emerald-700', 'bg-zinc-100', 'bg-emerald-100 text-emerald-700', '', 'bg-rose-100 text-rose-600', 'bg-emerald-100 text-emerald-700', 'bg-emerald-50 text-emerald-600', '', '', 'bg-rose-50 text-rose-500', 'bg-emerald-100 text-emerald-700', 'bg-emerald-100 text-emerald-700'];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-500/10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900">March 2026</span>
        <span className="text-xs font-medium text-emerald-600">+$840 month</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-zinc-400">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => (
          <div key={i} className={`flex h-7 items-center justify-center rounded-md text-[10px] font-medium ${tones[i] || 'text-zinc-300'}`}>{c}</div>
        ))}
      </div>
    </div>
  );
}

function MockChecklist() {
  const items = ['Market structure confirmed', 'Risk defined (1R)', 'News checked', 'Entry plan written'];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-500/10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900">Pre-session checklist</span>
        <span className="text-xs font-medium text-violet-600">3 / 4</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${i < 3 ? 'border-violet-500 bg-violet-500 text-white' : 'border-zinc-300 bg-white'}`}>
              {i < 3 && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </div>
            <span className={`text-sm ${i < 3 ? 'text-zinc-500 line-through' : 'font-medium text-zinc-800'}`}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockDashboard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-violet-500/15">
      <div className="flex border-b border-zinc-100">
        <div className="hidden w-36 shrink-0 border-r border-zinc-100 bg-zinc-50 p-3 sm:block">
          <div className="text-xs font-bold text-violet-600">FinhubKH</div>
          <div className="mt-4 space-y-1.5">
            {['Overview', 'Log', 'Calendar', 'Settings'].map((t, i) => (
              <div key={t} className={`rounded-lg px-2 py-1.5 text-[11px] font-medium ${i === 0 ? 'bg-violet-100 text-violet-700' : 'text-zinc-400'}`}>{t}</div>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              { l: 'Net result', v: '+$2,480', c: 'text-emerald-600' },
              { l: 'Win rate', v: '58%', c: 'text-violet-600' },
              { l: 'Profit factor', v: '1.72', c: 'text-zinc-900' },
              { l: 'Avg R', v: '+0.42R', c: 'text-emerald-600' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">{s.l}</div>
                <div className={`mt-1 text-base font-bold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
            <svg viewBox="0 0 400 100" className="h-24 w-full" aria-hidden="true">
              <defs>
                <linearGradient id="hero-eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 75 L50 70 L100 55 L150 60 L200 40 L250 35 L300 25 L350 20 L400 12 L400 100 L0 100 Z" fill="url(#hero-eq)" />
              <path d="M0 75 L50 70 L100 55 L150 60 L200 40 L250 35 L300 25 L350 20 L400 12" fill="none" stroke="#7c3aed" strokeWidth="2.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureMock({ type }) {
  if (type === 'journal') return <MockJournal />;
  if (type === 'analytics') return <MockAnalytics />;
  if (type === 'calendar') return <MockCalendar />;
  if (type === 'checklist') return <MockChecklist />;
  return null;
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-200">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-xl bg-zinc-50 px-3 py-4 text-left transition hover:bg-zinc-100"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-zinc-900">{q}</span>
        <span className={`shrink-0 text-xl text-violet-500 transition ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-zinc-600">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className={pageShell}>
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/30 bg-white/70 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex flex-col leading-none no-underline">
            <span className="text-sm font-bold text-zinc-900">FinhubKH</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Journal</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-zinc-600 transition hover:text-violet-600">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/dashboard" className={btnPrimary}>Open Journal</Link>
            ) : (
              <>
                <Link to="/login" className={`${btnOutline} hidden sm:inline-flex`}>Sign in</Link>
                <Link to="/login?mode=signup" className={btnPrimary}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative flex min-h-dvh items-center overflow-hidden border-b border-zinc-100 bg-gradient-to-b from-violet-50/80 via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-28 sm:px-8 lg:grid-cols-2 lg:py-32">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              The journal built for FinhubKH traders
            </p>
            <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-zinc-900">
              Everything you need to
              <span className="text-violet-600"> trade better.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-zinc-600">
              One platform for journaling, analytics, calendar review, and MT5 sync.
              Stop guessing. Start improving with data.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link to="/dashboard" className={btnPrimaryLg}>Go to Journal</Link>
              ) : (
                <>
                  <Link to="/login?mode=signup" className={btnPrimaryLg}>Start for free</Link>
                  <Link to="/login" className={`${btnOutline} px-8 py-3.5 text-[15px]`}>Sign in</Link>
                </>
              )}
            </div>
            <p className="mt-4 text-sm text-zinc-400">No credit card. Private by default.</p>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 blur-2xl" />
            <div className="relative"><MockDashboard /></div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-100 bg-zinc-50 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-center sm:px-8">
          {['MT5 auto-sync', 'Pre-trade checklist', 'Equity analytics', 'Multi-account', 'CSV export'].map((t) => (
            <span key={t} className="text-sm font-semibold text-zinc-500">{t}</span>
          ))}
        </div>
      </section>

      <section id="platform" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">Meet FinhubKH Journal</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
            The one platform that lets you do it all
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            All the tools you need to journal, analyze, and improve — without spreadsheets or scattered notes.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PLATFORM_TOOLS.map((t) => (
            <article key={t.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-violet-200 hover:shadow-md">
              <div className="mb-3 h-1 w-10 rounded-full bg-violet-500" />
              <h3 className="text-lg font-bold text-zinc-900">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
              Built for serious review sessions
            </h2>
            <p className="mt-4 text-lg text-zinc-600">Deep dives into every part of the journal — the same tools you get inside the app.</p>
          </div>
          <div className="space-y-24">
            {FEATURE_SECTIONS.map((f) => (
              <div key={f.id} className={`grid items-center gap-10 lg:grid-cols-2 ${f.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">{f.tag}</p>
                  <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">{f.title}</h3>
                  <p className="mt-4 text-base leading-relaxed text-zinc-600">{f.desc}</p>
                  <ul className="mt-6 space-y-2">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-zinc-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <FeatureMock type={f.mock} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-zinc-600">Up and running in minutes, not hours.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <article key={s.n} className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-4xl font-extrabold text-violet-100">{s.n}</div>
              <h3 className="mt-2 text-lg font-bold text-zinc-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Stats that help you trade better
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                Review every session, tag your setups, and track growth over time.
                Get the insights you need to refine strategy and stay disciplined.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {[
                  { v: '58%', l: 'Avg win rate tracked' },
                  { v: '1.7x', l: 'Profit factor visibility' },
                  { v: 'R', l: 'Multiples on every trade' },
                  { v: '24/7', l: 'Sync across devices' },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                    <div className="text-2xl font-bold text-violet-400">{s.v}</div>
                    <div className="mt-1 text-xs text-zinc-400">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <MockAnalytics />
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">Frequently asked questions</h2>
          <p className="mt-3 text-zinc-600">Quick answers before you start.</p>
        </div>
        <div className="mt-10">
          {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-8 py-14 text-center text-white shadow-xl shadow-violet-500/25 sm:px-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to become a more disciplined trader?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-violet-100">
            The one journal that brings logging, analytics, and discipline together. Get started today.
          </p>
          {!isAuthenticated && (
            <Link to="/login?mode=signup" className="mt-8 inline-flex rounded-xl bg-white px-8 py-3.5 text-[15px] font-semibold text-violet-700 transition hover:bg-violet-50">
              Get started free
            </Link>
          )}
          {isAuthenticated && (
            <Link to="/dashboard" className="mt-8 inline-flex rounded-xl bg-white px-8 py-3.5 text-[15px] font-semibold text-violet-700 transition hover:bg-violet-50">
              Open your journal
            </Link>
          )}
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-bold text-zinc-900">FinhubKH Journal</div>
            <p className="mt-1 text-xs text-zinc-500">Private trading journal for FinhubKH traders.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-zinc-500">
            <a href="#platform" className="hover:text-violet-600">Platform</a>
            <a href="#features" className="hover:text-violet-600">Features</a>
            <a href="#faq" className="hover:text-violet-600">FAQ</a>
            <Link to="/login" className="hover:text-violet-600">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
