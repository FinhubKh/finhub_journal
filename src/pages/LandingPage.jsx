import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EA_SYNC_ENDPOINT } from '../api/env';
import { btnPrimary, btnPrimaryLg, btnOutline, pageShell } from '../lib/ui';
import { ScrollReveal } from '../components/common/ScrollReveal';
import LeaderboardPreview from '../components/leaderboard/LeaderboardPreview';
import { BrandLogo } from '../components/BrandLogo';

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#leaderboard', label: 'Leaderboard' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#install', label: 'Install' },
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
    desc: 'Capture result, R-multiple, session, and notes in seconds. Filter by account, date, or setup so reviews stay focused.',
    bullets: ['Manual logging with smart defaults', 'Account-level filtering', 'Edit and review any past trade'],
    mock: 'journal',
  },
  {
    id: 'analytics',
    tag: 'Analytics',
    title: 'See what is driving profits and what is costing you',
    desc: 'Equity curve, breakdown by pair and session, and overview tiles update as soon as trades are logged or synced.',
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
  { n: '01', title: 'Create your account', desc: 'Sign up free and set your display name and checklist steps.' },
  { n: '02', title: 'Log or sync trades', desc: 'Add trades manually or connect the MT5 EA to import closed history automatically.' },
  { n: '03', title: 'Review and improve', desc: 'Use overview, calendar, and breakdown reports to refine your edge every week.' },
];

const INSTALL_STEPS = [
  {
    n: '01',
    title: 'Download the EA',
    desc: 'Download FinhubJournal_TradeSync.ex5 below. One file — no compile step needed.',
  },
  {
    n: '02',
    title: 'Create accounts & sync keys',
    desc: 'Sign up, add trading accounts under Accounts, and generate a sync key for each MT5 account.',
  },
  {
    n: '03',
    title: 'Copy into MetaTrader',
    desc: 'Place FinhubJournal_TradeSync.ex5 in your MT5 Experts folder (File → Open Data Folder → MQL5 → Experts).',
  },
  {
    n: '04',
    title: 'Allow WebRequest in MT5',
    desc: 'Tools → Options → Expert Advisors → tick “Allow WebRequest for listed URL” and add https://journal.finhubkh.com and https://finhubjournal.vercel.app.',
  },
  {
    n: '05',
    title: 'Attach & paste the account sync key',
    desc: 'Drag the EA onto any chart. Paste the sync key for that journal account into the EA — one key per MT5 terminal.',
  },
  {
    n: '06',
    title: 'Start MT5 — trades sync automatically',
    desc: 'The EA syncs on attach and every few minutes while it stays on a chart. Check the Experts tab for a success message.',
  },
];

const EA_DOWNLOAD_URL = '/FinhubJournal_TradeSync.ex5';

const FAQS = [
  { q: 'Is FinhubKH Journal free?', a: 'Yes. Create an account and start journaling at no cost. Your data is private to your account.' },
  { q: 'How does MT5 sync work?', a: 'Generate a sync key per trading account in Settings, paste it into the FinhubKH EA on that MT5 terminal, and closed trades import on startup.' },
  { q: 'Can I use multiple accounts?', a: 'Yes. Each journal account has its own sync key. Use a different key on each MT5 terminal and filter the journal by account.' },
  { q: 'Is my data shared publicly?', a: 'By default, no — trades and stats are private. If you publish a trading account in Settings, anyone with the share link can view that account’s stats and trade history (notes stay private), and it may appear on the public leaderboard. You can unpublish or regenerate the link anytime.' },
];

function MockJournal() {
  const rows = [
    { sym: 'XAUUSD', r: '+2.0R', pnl: '+$240', res: 'win' },
    { sym: 'NAS100', r: '-1.0R', pnl: '-$120', res: 'loss' },
    { sym: 'EURUSD', r: '+1.5R', pnl: '+$180', res: 'win' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-violet-900/20">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Recent trades</span>
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">Live</span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((r) => (
          <div key={r.sym} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.sym}</div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500">London session</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold ${r.res === 'win' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{r.pnl}</div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500">{r.r}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockAnalytics() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-violet-900/20">
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Net PnL', v: '+$1,240', c: 'text-emerald-600 dark:text-emerald-400' },
          { l: 'Win rate', v: '62%', c: 'text-violet-600 dark:text-violet-400' },
          { l: 'Profit factor', v: '1.84', c: 'text-zinc-900 dark:text-zinc-100' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/80">
            <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{s.l}</div>
            <div className={`mt-1 text-lg font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/80">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Equity curve</div>
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
  const tones = [
    '',
    '',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    '',
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    'bg-rose-50 text-rose-500 dark:bg-rose-950/60 dark:text-rose-400',
    '',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-zinc-100 dark:bg-zinc-800',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    '',
    'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    '',
    '',
    'bg-rose-50 text-rose-500 dark:bg-rose-950/60 dark:text-rose-400',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-violet-900/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">March 2026</span>
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">+$840 month</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => (
          <div key={i} className={`flex h-7 items-center justify-center rounded-md text-[10px] font-medium ${tones[i] || 'text-zinc-300 dark:text-zinc-600'}`}>{c}</div>
        ))}
      </div>
    </div>
  );
}

function MockChecklist() {
  const items = ['Market structure confirmed', 'Risk defined (1R)', 'News checked', 'Entry plan written'];
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-violet-900/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pre-session checklist</span>
        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">3 / 4</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${i < 3 ? 'border-violet-500 bg-violet-500 text-white' : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900'}`}>
              {i < 3 && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </div>
            <span className={`text-sm ${i < 3 ? 'text-zinc-500 line-through dark:text-zinc-500' : 'font-medium text-zinc-800 dark:text-zinc-200'}`}>{item}</span>
          </div>
        ))}
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
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-xl bg-zinc-50 px-3 py-4 text-left transition hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q}</span>
        <span className={`shrink-0 text-xl text-violet-500 transition ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="pb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const TICKER_ITEMS = ['MT5 auto-sync', 'Pre-trade checklist', 'Equity analytics', 'Multi-account', 'CSV export'];

  return (
    <div className={pageShell}>
      <header className={`landing-header absolute inset-x-0 top-0 z-20 border-b border-white/30 bg-white/70 backdrop-blur-lg dark:border-zinc-800/60 dark:bg-zinc-950/70 ${headerScrolled ? 'landing-header-scrolled' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <BrandLogo size="md" />
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-zinc-600 transition hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to={isAdmin ? '/admin' : '/dashboard'} className={btnPrimary}>{isAdmin ? 'Open Admin' : 'Open Journal'}</Link>
            ) : (
              <>
                <Link to="/login" className={`${btnOutline} hidden sm:inline-flex`}>Sign in</Link>
                <Link to="/login?mode=signup" className={btnPrimary}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative flex min-h-dvh items-center overflow-hidden border-b border-zinc-100 bg-gradient-to-b from-violet-50/80 via-white to-white dark:border-zinc-800 dark:from-violet-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl landing-hero-glow dark:bg-violet-700/20" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-fuchsia-200/30 blur-3xl landing-hero-glow dark:bg-fuchsia-800/15" style={{ animationDelay: '1.5s' }} />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-28 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] lg:gap-8 lg:py-32">
          <div>
            <h1 className="landing-hero-in text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight text-zinc-900 dark:text-zinc-50">
              Everything you need to
              <span className="text-violet-600 dark:text-violet-400"> trade better.</span>
            </h1>
            <p className="landing-hero-in landing-hero-in-d1 mt-5 max-w-lg text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              One platform for journaling, analytics, calendar review, and MT5 sync.
              Stop guessing. Start improving with data.
            </p>
            <div className="landing-hero-in landing-hero-in-d2 mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link to={isAdmin ? '/admin' : '/dashboard'} className={btnPrimaryLg}>{isAdmin ? 'Open Admin' : 'Go to Journal'}</Link>
              ) : (
                <>
                  <Link to="/login?mode=signup" className={btnPrimaryLg}>Start for free</Link>
                  <Link to="/login" className={`${btnOutline} px-8 py-3.5 text-[15px]`}>Sign in</Link>
                </>
              )}
            </div>
            <p className="landing-hero-in landing-hero-in-d3 mt-4 text-sm text-zinc-400 dark:text-zinc-500">No credit card. Private by default.</p>
          </div>
          <div className="relative landing-hero-mock lg:-mr-4 xl:-mr-8">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 blur-2xl landing-hero-glow dark:from-violet-500/20 dark:to-fuchsia-500/10" />
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-violet-900/30">
              <img
                src="/image/heroSection.png"
                alt="FinhubKH Journal overview dashboard"
                className="block h-auto w-full min-w-0"
                width={1600}
                height={1000}
                decoding="async"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-b border-zinc-100 bg-zinc-50 py-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        <ScrollReveal direction="fade" className="landing-ticker-wrap py-1">
          <div className="landing-ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
              <span key={`${t}-${i}`} className="shrink-0 px-5 text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t}</span>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <LeaderboardPreview variant="landing" limit={10} />

      <section id="platform" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">Meet FinhubKH Journal</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            The one platform that lets you do it all
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            All the tools you need to journal, analyze, and improve — without spreadsheets or scattered notes.
          </p>
        </ScrollReveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PLATFORM_TOOLS.map((t, i) => (
            <ScrollReveal key={t.title} delay={i * 100}>
              <article className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-800 dark:hover:shadow-violet-950/40">
                <div className="mb-3 h-1 w-10 rounded-full bg-violet-500" />
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t.desc}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section id="features" className="bg-zinc-50 py-20 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ScrollReveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Built for serious review sessions
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">Deep dives into every part of the journal — the same tools you get inside the app.</p>
          </ScrollReveal>
          <div className="space-y-24">
            {FEATURE_SECTIONS.map((f) => (
              <div key={f.id} className={`grid items-center gap-10 lg:grid-cols-2 ${f.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <ScrollReveal direction={f.reverse ? 'right' : 'left'}>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">{f.tag}</p>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">{f.title}</h3>
                    <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">{f.desc}</p>
                    <ul className="mt-6 space-y-2">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
                <ScrollReveal direction={f.reverse ? 'left' : 'right'} delay={120}>
                  <FeatureMock type={f.mock} />
                </ScrollReveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">Up and running in minutes, not hours.</p>
        </ScrollReveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 120}>
              <article className="h-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-violet-950/30">
                <div className="text-4xl font-extrabold text-violet-100 dark:text-violet-950">{s.n}</div>
                <h3 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.desc}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section id="install" className="border-y border-zinc-100 bg-white py-20 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">MT5 setup</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Install the FinhubKH sync EA
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Free, read-only sync — the EA only reads closed trade history and never places or modifies trades.
            </p>
          </ScrollReveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {INSTALL_STEPS.map((s, i) => (
              <ScrollReveal key={s.n} delay={(i % 3) * 90} direction="scale">
                <article className="h-full rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 transition duration-300 hover:border-violet-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-violet-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
                    {s.n}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.desc}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={100} className="mt-10 flex justify-center">
            <a
              href={EA_DOWNLOAD_URL}
              download="FinhubJournal_TradeSync.ex5"
              className={`${btnPrimaryLg} gap-2`}
            >
              Download FinhubJournal_TradeSync.ex5
            </a>
          </ScrollReveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <div className="h-full rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">EA file</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  One compiled file — copy into your MT5 Experts folder:
                </p>
                <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 font-mono text-sm font-semibold text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
                  FinhubJournal_TradeSync.ex5
                </div>
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                  The sync API URL is built in. No compile step and no extra config files.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={100}>
              <div className="h-full rounded-2xl border border-violet-200 bg-violet-50/60 p-6 dark:border-violet-900/40 dark:bg-violet-950/30">
                <h3 className="text-sm font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Allow WebRequest URL</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Add both URLs in MT5 under Tools → Options → Expert Advisors:
                </p>
                <div className="mt-4 space-y-2">
                  {['https://journal.finhubkh.com', 'https://finhubjournal.vercel.app'].map((url) => (
                    <div key={url} className="break-all rounded-xl border border-violet-200 bg-white px-4 py-3 font-mono text-sm text-violet-900 select-all dark:border-violet-900/50 dark:bg-zinc-950 dark:text-violet-200">
                      {url}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                  Sync endpoint: <span className="font-mono text-zinc-700 dark:text-zinc-300">{EA_SYNC_ENDPOINT}</span>
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal delay={80} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                state={{ tab: 'setup' }}
                className={btnPrimaryLg}
              >
                Open MT5 setup
              </Link>
            ) : (
              <Link to="/login?mode=signup" className={btnPrimaryLg}>
                Sign up to get your Sync Key
              </Link>
            )}
            <a href="#faq" className={`${btnOutline} px-8 py-3.5 text-[15px]`}>
              Read FAQ
            </a>
          </ScrollReveal>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-900 py-20 text-white dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <ScrollReveal direction="left">
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
                  ].map((s, i) => (
                    <ScrollReveal key={s.l} delay={i * 80} direction="scale">
                      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition duration-300 hover:border-violet-500/40 hover:bg-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/80">
                        <div className="text-2xl font-bold text-violet-400">{s.v}</div>
                        <div className="mt-1 text-xs text-zinc-400">{s.l}</div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={150}>
              <MockAnalytics />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <ScrollReveal className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Frequently asked questions</h2>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">Quick answers before you start.</p>
        </ScrollReveal>
        <div className="mt-10">
          {FAQS.map((f, i) => (
            <ScrollReveal key={f.q} delay={i * 70}>
              <FaqItem q={f.q} a={f.a} />
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <ScrollReveal direction="scale">
          <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-8 py-14 text-center text-white shadow-xl shadow-violet-500/25 transition duration-500 hover:shadow-2xl hover:shadow-violet-500/30 dark:shadow-violet-950/40 sm:px-12">
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
            <Link to={isAdmin ? '/admin' : '/dashboard'} className="mt-8 inline-flex rounded-xl bg-white px-8 py-3.5 text-[15px] font-semibold text-violet-700 transition hover:bg-violet-50">
              {isAdmin ? 'Open Admin Panel' : 'Open your journal'}
            </Link>
          )}
          </div>
        </ScrollReveal>
      </section>

      <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandLogo size="md" as="div" />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">Private trading journal for FinhubKH traders.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#platform" className="hover:text-violet-600 dark:hover:text-violet-400">Platform</a>
            <a href="#features" className="hover:text-violet-600 dark:hover:text-violet-400">Features</a>
            <a href="#install" className="hover:text-violet-600 dark:hover:text-violet-400">Install</a>
            <a href="#faq" className="hover:text-violet-600 dark:hover:text-violet-400">FAQ</a>
            <Link to="/login" className="hover:text-violet-600 dark:hover:text-violet-400">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
