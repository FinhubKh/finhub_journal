import CalendarPanel from '../components/news/CalendarPanel';
import { dashboardPageWide } from '../lib/ui';

export default function EconomicCalendarPage() {
  return (
    <div className={dashboardPageWide}>
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Economic calendar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          High-impact macro events, releases, and data that can move markets.
        </p>
      </header>
      <CalendarPanel />
    </div>
  );
}
