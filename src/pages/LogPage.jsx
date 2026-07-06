import TradeForm from '../components/tabs/TradeForm';
import TradeList from '../components/tabs/TradeList';
import { dashboardPage } from '../lib/ui';

export default function LogPage() {
  return (
    <div className={dashboardPage}>
      <div className="space-y-4">
        <TradeForm />
        <TradeList />
      </div>
    </div>
  );
}
