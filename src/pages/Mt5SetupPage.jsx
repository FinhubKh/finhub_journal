import { useNavigate } from 'react-router-dom';
import InstallGuideCard from '../components/InstallGuideCard';
import { dashboardPageWide } from '../lib/ui';

export default function Mt5SetupPage() {
  const navigate = useNavigate();

  return (
    <div className={dashboardPageWide}>
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">MT5 setup</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Download the EA, generate a sync key per trading account, and connect MetaTrader 5 to import closed trades automatically.
        </p>
      </header>

      <InstallGuideCard standalone />

      <p className="mt-6 text-center text-sm text-zinc-500">
        Need trading accounts or sync keys?{' '}
        <button
          type="button"
          className="font-semibold text-violet-600 hover:text-violet-700"
          onClick={() => navigate('/dashboard', { state: { tab: 'settings', section: 'trading-accounts' } })}
        >
          Open Settings → Account
        </button>
      </p>
    </div>
  );
}
