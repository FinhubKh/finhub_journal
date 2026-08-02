import { useState } from 'react';
import InstallGuideCard from '../components/settings/InstallGuideCard';
import InvestorGuideCard from '../components/settings/InvestorGuideCard';
import { dashboardPageWideFull } from '../lib/ui';

const METHODS = [
  {
    id: 'ea',
    title: 'EA sync key',
    desc: 'Install the EA on MetaTrader 5 and paste a sync key. Best if you keep MT5 open locally.',
    meta: 'Local terminal',
  },
  {
    id: 'investor',
    title: 'Investor password',
    desc: 'Read-only login. We pull closed trades for you — no EA install required.',
    meta: 'Cloud sync',
    badge: 'Easiest',
  },
];

function MethodIcon({ id }) {
  if (id === 'investor') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 10.5 12 15l4.5-4.5M12 15V3" />
    </svg>
  );
}

export default function SetupPage() {
  const [method, setMethod] = useState('investor');

  return (
    <div className={`${dashboardPageWideFull} flex min-h-0 flex-col`}>
      <header className="mb-5 shrink-0 animate-install-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-emerald-400">
          MT5 connection
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Choose your sync method
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Connect MetaTrader 5 with an investor password, or install the local EA. Both paths keep closed trades in your journal.
        </p>
      </header>

      <fieldset className="mb-5 shrink-0 animate-install-fade-up">
        <legend className="sr-only">Sync method</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {METHODS.map((item) => {
            const active = method === item.id;
            return (
              <label
                key={item.id}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border px-4 py-4 transition duration-200 ${
                  active
                    ? 'border-violet-400 bg-white shadow-sm ring-2 ring-violet-200 dark:border-emerald-500 dark:bg-zinc-900 dark:ring-emerald-900/50'
                    : 'border-zinc-200 bg-white/80 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="setupMethod"
                  value={item.id}
                  checked={active}
                  onChange={() => setMethod(item.id)}
                />
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                      active
                        ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25 dark:bg-emerald-600 dark:shadow-emerald-900/40'
                        : 'bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    <MethodIcon id={item.id} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                      {item.badge ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                    <p
                      className={`mt-2 text-[11px] font-semibold uppercase tracking-wider ${
                        active ? 'text-violet-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {item.meta}
                    </p>
                  </div>
                  <span
                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      active
                        ? 'border-violet-600 bg-violet-600 dark:border-emerald-500 dark:bg-emerald-500'
                        : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900'
                    }`}
                    aria-hidden
                  >
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex min-h-0 flex-1 flex-col">
        {method === 'ea' ? <InstallGuideCard standalone /> : <InvestorGuideCard standalone />}
      </div>
    </div>
  );
}
