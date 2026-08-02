import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { EA_WEBREQUEST_ORIGIN } from '../../api/env';
import { btnOutline, btnPrimary, btnGhost, card } from '../../lib/ui';

const EA_DOWNLOAD_URL = '/FinhubJournal_TradeSync.ex5';

const STEPS = [
  {
    n: 1,
    title: 'Download the EA',
    desc: 'Get the FinhubJournal_TradeSync.ex5 file. No install wizard needed — just one file.',
    tip: 'Save it somewhere easy to find, like your Desktop.',
    action: 'download',
    image: '/image/install/step-1.png',
    imageAlt: 'Download FinhubJournal_TradeSync.ex5',
  },
  {
    n: 2,
    title: 'Put it in MetaTrader 5',
    desc: 'In MT5 open File → Open Data Folder → MQL5 → Experts. Paste the .ex5 file there.',
    tip: 'Restart MT5 (or right-click Experts → Refresh) so the EA shows up in Navigator.',
    action: null,
    image: '/image/install/step-2.png',
    imageAlt: 'Place the EA file in MQL5 Experts folder',
  },
  {
    n: 3,
    title: 'Allow Finhub to connect',
    desc: 'In MT5 go to Tools → Options → Expert Advisors. Enable “Allow WebRequest for listed URL”, then add this website URL.',
    tip: 'Copy the URL below and paste it into the MT5 allow list.',
    action: 'copy-url',
    image: '/image/install/step-3.png',
    imageAlt: 'Allow WebRequest URL in MetaTrader 5 options',
  },
  {
    n: 4,
    title: 'Get your sync key',
    desc: 'In Finhub open Settings → Account. Create or pick a trading account, then generate a sync key and copy it.',
    tip: 'Use one sync key per MT5 account.',
    action: 'accounts',
    image: '/image/install/step-4.png',
    imageAlt: 'Generate sync key in Finhub account settings',
  },
  {
    n: 5,
    title: 'Attach EA & paste the key',
    desc: 'Drag FinhubJournal_TradeSync onto any chart. Paste your sync key in the EA inputs, then click OK.',
    tip: 'Keep MT5 running so trades can sync. You’re done when closed trades appear in your journal.',
    action: 'done',
    image: '/image/install/step-5.png',
    imageAlt: 'Attach EA to a chart and paste sync key',
  },
];

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy — select and copy manually');
  }
}

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
                  ? 'bg-violet-600 scale-y-125 dark:bg-emerald-500'
                  : done
                    ? 'bg-violet-300 dark:bg-emerald-800'
                    : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepAction({ action, onAccounts }) {
  if (action === 'download') {
    return (
      <a className={`${btnPrimary} inline-flex w-full animate-install-fade-up sm:w-auto`} href={EA_DOWNLOAD_URL} download>
        Download EA for MT5
      </a>
    );
  }

  if (action === 'copy-url') {
    return (
      <div className="space-y-2 animate-install-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Website URL</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {EA_WEBREQUEST_ORIGIN}
          </code>
          <button
            className={btnOutline}
            type="button"
            onClick={() => void copyText(EA_WEBREQUEST_ORIGIN, 'Website URL')}
          >
            Copy URL
          </button>
        </div>
      </div>
    );
  }

  if (action === 'accounts') {
    return (
      <button className={`${btnPrimary} inline-flex w-full animate-install-fade-up sm:w-auto`} type="button" onClick={onAccounts}>
        Open accounts & sync keys
      </button>
    );
  }

  if (action === 'done') {
    return (
      <div className="animate-install-fade-up rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        Setup complete — your closed trades will sync into the journal.
      </div>
    );
  }

  return null;
}

export default function InstallGuideCard({ defaultOpen = true, standalone = false }) {
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
    navigate('/dashboard', { state: { tab: 'settings', section: 'trading-accounts' } });
  }

  const slideClass = direction >= 0 ? 'animate-install-in-right' : 'animate-install-in-left';

  return (
    <section
      className={`${card} ${standalone ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden' : ''}`}
      aria-label="How to install MT5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">How to install MT5</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Follow each step. Use Next when you’re ready.
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
            className={`overflow-hidden rounded-2xl border border-zinc-100 bg-gradient-to-br from-zinc-50 to-white dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-950 ${slideClass}`}
            role="group"
            aria-labelledby={`install-step-${step.n}-title`}
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-950">
              <img
                src={step.image}
                alt={step.imageAlt}
                className="h-full w-full object-cover object-center"
                loading="eager"
                decoding="async"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950/50 to-transparent" />
            </div>

            <div className="flex items-start gap-4 p-5 sm:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-lg font-bold text-white shadow-sm shadow-violet-600/25 dark:bg-emerald-600 dark:shadow-emerald-900/40">
                {step.n}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h4
                  id={`install-step-${step.n}-title`}
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
                    toast.success('Guide restarted');
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
