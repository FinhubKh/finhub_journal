import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { btnGhost, btnPrimary, card } from '../../lib/ui';

const STEPS = [
  {
    n: 1,
    title: 'Create or pick an account',
    desc: 'In Finhub open Accounts. Add a trading account, or use one you already have.',
    tip: 'Choose Investor password when creating the account, or connect it later on the account card.',
    action: 'accounts',
  },
  {
    n: 2,
    title: 'Find your investor password',
    desc: 'In MetaTrader 5, open your account details and copy the investor (read-only) password — not the master password.',
    tip: 'Investor access can view history but cannot place trades. That is what we need for sync.',
    action: null,
  },
  {
    n: 3,
    title: 'Connect credentials in Finhub',
    desc: 'On the account card, open Investor password sync. Choose your broker, pick the MT5 server, then enter login and investor password.',
    tip: 'ST Markets and Lirunex are listed — or type the exact server from your broker portal (e.g. Exness-MT5Real36).',
    action: 'accounts',
  },
  {
    n: 4,
    title: 'Sync your closed trades',
    desc: 'Save credentials, then use Sync Now. Closed trades pull into your journal — no EA install required.',
    tip: 'You’re done when trades appear in the journal. Sync again anytime for a fresh pull.',
    action: 'done',
  },
];

function ProgressTrack({ current, total, onJump }) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        <span>
          Step {current + 1} of {total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: total }, (_, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onJump(i)}
              className={`h-2.5 flex-1 min-w-8 rounded-full transition-all duration-300 ${
                active
                  ? 'scale-y-125 bg-violet-600 dark:bg-emerald-500'
                  : done
                    ? 'bg-violet-300 dark:bg-emerald-800'
                    : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepAction({ action, onAccounts }) {
  if (action === 'accounts') {
    return (
      <button className={`${btnPrimary} inline-flex w-full animate-install-fade-up sm:w-auto`} type="button" onClick={onAccounts}>
        Open accounts & investor sync
      </button>
    );
  }

  if (action === 'done') {
    return (
      <div className="animate-install-fade-up rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        Setup complete — sync anytime with investor password. No EA needed.
      </div>
    );
  }

  return null;
}

export default function InvestorGuideCard({ defaultOpen = true, standalone = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(standalone || defaultOpen);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animKey, setAnimKey] = useState(0);

  const step = STEPS[index];
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  useEffect(() => {
    if (!standalone) return undefined;
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (index < STEPS.length - 1) goTo(index + 1, 1);
      }
      if (e.key === 'ArrowLeft') {
        if (index > 0) goTo(index - 1, -1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [standalone, index]);

  function goTo(next, dir) {
    if (next < 0 || next >= STEPS.length || next === index) return;
    setDirection(dir);
    setIndex(next);
    setAnimKey((k) => k + 1);
  }

  function goAccounts() {
    navigate('/dashboard/accounts');
  }

  const slideClass = direction >= 0 ? 'animate-install-in-right' : 'animate-install-in-left';

  return (
    <section
      className={`${card} ${standalone ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden' : ''}`}
      aria-label="How to sync with investor password"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              No EA required
            </span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Read-only
            </span>
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Investor password sync</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Connect with a read-only MT5 login. We pull closed trades for you.
          </p>
        </div>
        {!standalone ? (
          <button
            className={btnGhost}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'Hide' : 'Show'}
          </button>
        ) : null}
      </div>

      {(standalone || open) && (
        <div className={`flex flex-col gap-6 px-5 py-5 ${standalone ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}>
          <ProgressTrack
            current={index}
            total={STEPS.length}
            onJump={(i) => goTo(i, i > index ? 1 : -1)}
          />

          <div
            key={animKey}
            className={`overflow-hidden rounded-2xl border border-zinc-200 bg-linear-to-br from-zinc-50 to-white shadow-sm dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-950 ${slideClass}`}
            role="group"
            aria-labelledby={`investor-step-${step.n}-title`}
          >
            <div className="flex items-start gap-4 p-5 sm:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-lg font-bold text-white shadow-sm shadow-violet-600/25 dark:bg-emerald-600 dark:shadow-emerald-900/40">
                {step.n}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h4
                  id={`investor-step-${step.n}-title`}
                  className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
                >
                  {step.title}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {step.desc}
                </p>
                {step.tip ? (
                  <p className="mt-3 rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-violet-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Tip: {step.tip}
                  </p>
                ) : null}
                <div className="mt-4">
                  <StepAction action={step.action} onAccounts={goAccounts} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              className={btnGhost}
              type="button"
              disabled={isFirst}
              onClick={() => goTo(index - 1, -1)}
            >
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              {!isLast ? (
                <button className={btnPrimary} type="button" onClick={() => goTo(index + 1, 1)}>
                  Next step
                </button>
              ) : (
                <button
                  className={btnPrimary}
                  type="button"
                  onClick={() => {
                    setDirection(1);
                    setIndex(0);
                    setAnimKey((k) => k + 1);
                  }}
                >
                  Start over
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
