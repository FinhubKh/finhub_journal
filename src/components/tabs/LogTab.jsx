import TradeForm from './TradeForm';
import TradeList from './TradeList';

export default function LogTab() {
  return (
    <div className="pane-inner">
      <TradeForm />
      <TradeList />
    </div>
  );
}
