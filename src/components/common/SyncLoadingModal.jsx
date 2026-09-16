import { useEffect, useMemo } from 'react';
import { platformLabel, platformShort } from '../../lib/accounts';
import { btnGhost, card } from '../../lib/ui';

function stepStatus(stepIndex, currentIndex) {
  if (currentIndex === -1) return stepIndex === 0 ? 'active' : 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

function StepIcon({ status }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.415l-7.004 7a1 1 0 01-1.414 0l-3.004-3a1 1 0 111.414-1.415l2.297 2.297 6.297-6.296a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-violet-600 dark:border-zinc-700 dark:border-t-emerald-400"
        aria-hidden
      />
    );
  }
  return (
    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-200 dark:border-zinc-700" aria-hidden />
  );
}

/** Parse bridge sync_stage values like `queued:3` or `connecting`. */
export function parseSyncStage(stage) {
  if (!stage || typeof stage !== 'string') {
    return { name: null, queueAhead: null };
  }
  if (stage === 'queued' || stage.startsWith('queued:')) {
    const raw = stage.includes(':') ? Number(stage.split(':')[1]) : null;
    const queueAhead = Number.isFinite(raw) ? raw : null;
    return { name: 'queued', queueAhead };
  }
  return { name: stage, queueAhead: null };
}

export function syncStageLabel(stage, platform) {
  const short = platformShort(platform);
  const { name, queueAhead } = parseSyncStage(stage);
  if (name === 'queued') {
    if (queueAhead === 0) return 'Next in line for a free terminal…';
    if (queueAhead != null) return `Waiting for a free terminal — about ${queueAhead} ahead`;
    return 'Waiting for a free terminal…';
  }
  if (name === 'fetching_history') return 'Fetching history…';
  if (name === 'saving_trades') return 'Saving trades…';
  if (name === 'connecting') return `Connecting to ${short}…`;
  return `Syncing ${short}…`;
}

/**
 * Loading overlay shown while investor MetaTrader sync is in progress.
 * `stage` mirrors investor_credentials.sync_stage, patched live by the bridge worker.
 * Pass `onBackground` to allow dismissing the overlay while sync continues.
 */
export default function SyncLoadingModal({ open, accountName, stage, platform, onBackground }) {
  const short = platformShort(platform);
  const full = platformLabel(platform);
  const { name: stageName, queueAhead } = parseSyncStage(stage);
  const queueLabel =
    queueAhead === 0
      ? 'Waiting for free terminal (next up)'
      : queueAhead != null
        ? `Waiting for free terminal (${queueAhead} ahead)`
        : 'Waiting for free terminal';

  const steps = useMemo(
    () => [
      { stage: 'queued', label: queueLabel },
      { stage: 'connecting', label: `Connecting to ${short}` },
      { stage: 'fetching_history', label: 'Fetching trade history' },
      { stage: 'saving_trades', label: 'Saving trades' },
    ],
    [short, queueLabel],
  );

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const currentIndex = stageName
    ? steps.findIndex((s) => s.stage === stageName)
    : -1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/45 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="sync-loading-title"
      aria-describedby="sync-loading-message"
    >
      <div className={`${card} w-full max-w-sm shadow-xl dark:bg-zinc-900`}>
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <h2
            id="sync-loading-title"
            className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            Syncing {short} trades
          </h2>
          <p
            id="sync-loading-message"
            className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
          >
            {accountName ? `“${accountName}”` : `Pulling closed trades from ${full}.`}
          </p>

          <ol className="mt-6 w-full space-y-3 text-left">
            {steps.map((step, i) => {
              const status = stepStatus(i, currentIndex);
              return (
                <li key={step.stage} className="flex items-center gap-3">
                  <StepIcon status={status} />
                  <span
                    className={
                      status === 'pending'
                        ? 'text-sm text-zinc-400 dark:text-zinc-600'
                        : status === 'active'
                          ? 'text-sm font-medium text-zinc-900 dark:text-zinc-100'
                          : 'text-sm text-zinc-500 dark:text-zinc-400'
                    }
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="mt-6 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {stageName === 'queued'
              ? 'You can leave — sync continues in the background'
              : platformShort(platform) === 'MT4'
                ? 'MT4 can take up to a few minutes'
                : 'Usually finishes in under a minute'}
          </p>

          {typeof onBackground === 'function' ? (
            <button
              type="button"
              className={`${btnGhost} mt-4 text-sm`}
              onClick={onBackground}
            >
              Continue in background
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
