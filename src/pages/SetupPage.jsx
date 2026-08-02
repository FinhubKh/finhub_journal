import InstallGuideCard from '../components/settings/InstallGuideCard';
import { dashboardPageWideFull } from '../lib/ui';

export default function SetupPage() {
  return (
    <div className={`${dashboardPageWideFull} flex min-h-0 flex-col`}>
      <header className="mb-6 shrink-0 animate-install-fade-up">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">How to install</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Step-by-step setup for MetaTrader 5 sync.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <InstallGuideCard standalone />
      </div>
    </div>
  );
}
