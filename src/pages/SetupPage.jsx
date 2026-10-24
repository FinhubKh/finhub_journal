import InvestorGuideCard from '../components/settings/InvestorGuideCard';
import { dashboardPageWideFull } from '../lib/ui';

export default function SetupPage() {
  return (
    <div className={`${dashboardPageWideFull} flex min-h-0 flex-col`}>
      <header className="mb-5 shrink-0 animate-install-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
          MetaTrader connection
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Connect with your investor password
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Connect MetaTrader 4 or 5 with its read-only investor password. Closed trades sync to your journal automatically — nothing to install on your PC.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <InvestorGuideCard standalone />
      </div>
    </div>
  );
}
