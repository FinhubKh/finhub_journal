import TradeList from '../components/journal/TradeList';

export default function LogPage() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col px-4 py-4 md:px-8 md:py-5">
      <TradeList />
    </div>
  );
}
