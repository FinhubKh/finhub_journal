import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EA_SYNC_ENDPOINT, EA_WEBREQUEST_ORIGIN } from '../../api/env';
import { btnOutline, btnPrimary, btnSecondary, btnGhost, card, cardBody, cardHd, cardTitle } from '../../lib/ui';

const EA_DOWNLOAD_URL = '/FinhubJournal_TradeSync.ex5';

const STEPS = [
  {
    n: '01',
    title: 'Download the EA',
    desc: 'Download FinhubJournal_TradeSync.ex5 — one file, no compile step.',
  },
  {
    n: '02',
    title: 'Create accounts & sync keys',
    desc: 'Add each trading account under Settings → Account. Generate a unique sync key per account.',
  },
  {
    n: '03',
    title: 'Install in MetaTrader 5',
    desc: 'Copy the .ex5 into MQL5 → Experts (File → Open Data Folder). Restart MT5 or refresh Experts.',
  },
  {
    n: '04',
    title: 'Allow WebRequest',
    desc: 'Tools → Options → Expert Advisors → allow WebRequest for the URL below.',
  },
  {
    n: '05',
    title: 'Attach EA and sync',
    desc: 'Drag the EA onto a chart. Paste that account\'s sync key into the EA inputs — one key per MT5 account.',
  },
];

export default function InstallGuideCard({ defaultOpen = true, compact = false, standalone = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(standalone || defaultOpen);

  function goSettings(section) {
    navigate('/dashboard', { state: { tab: 'settings', section } });
  }

  return (
    <section className={`${card} ${standalone ? 'flex flex-col h-full flex-1' : ''}`} aria-label="MT5 setup guide">
      <div className={cardHd}>
        <div>
          <h3 className={cardTitle}>MT5 setup guide</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Connect MetaTrader 5 to sync closed trades automatically.
          </p>
        </div>
        {!standalone && (
          <div className="flex flex-wrap items-center gap-2">
            {!compact && (
              <button className={btnSecondary} type="button" onClick={() => goSettings('trading-accounts')}>
                Accounts
              </button>
            )}
            <button
              className={btnGhost}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
      </div>

      {(standalone || open) && (
        <div className={`${cardBody} border-t border-zinc-100 dark:border-zinc-800 pt-5 ${standalone ? 'flex-1 overflow-y-auto' : 'space-y-6'}`}>
          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6 h-full">
            <ol className="space-y-3">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-emerald-950/80 text-xs font-bold text-violet-700 dark:text-emerald-400 border border-transparent dark:border-emerald-800/40">
                    {step.n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">EA download</div>
                <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">FinhubJournal_TradeSync.ex5</p>
                <a className={`${btnPrimary} mt-3 inline-flex`} href={EA_DOWNLOAD_URL} download>
                  Download EA
                </a>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">WebRequest URL</div>
                <p className="mt-2 break-all rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                  {EA_WEBREQUEST_ORIGIN}
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sync endpoint</p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">{EA_SYNC_ENDPOINT}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={btnOutline} type="button" onClick={() => goSettings('trading-accounts')}>
                  Manage accounts & keys
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
