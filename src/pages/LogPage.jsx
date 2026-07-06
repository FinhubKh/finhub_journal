import TradeForm from '../components/tabs/TradeForm';
import TradeList from '../components/tabs/TradeList';

export default function LogPage() {
  return (
    <div className="pane-inner">
      <TradeForm />
      <TradeList />
    </div>
  );
}
