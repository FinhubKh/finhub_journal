import { useEffect, useMemo, useState } from 'react';
import ChecklistCard from '../components/journal/ChecklistCard';
import ChecklistStepModal from '../components/modals/ChecklistStepModal';
import CreateStrategyModal from '../components/modals/CreateStrategyModal';
import AiChecklistSidebar from '../components/checklist/AiChecklistSidebar';
import StrategyChecklistList from '../components/checklist/StrategyChecklistList';
import MarketChartFrame from '../components/checklist/MarketChartFrame';
import BackButton from '../components/common/BackButton';
import { useAppData } from '../context/AppDataContext';
import { dashboardPageWideFull, btnPrimary, btnOutline } from '../lib/ui';

const MARKET_VISIBLE_KEY = 'finhub_checklist_market_visible';

function readMarketVisible() {
  try {
    const saved = localStorage.getItem(MARKET_VISIBLE_KEY);
    if (saved === '0') return false;
    if (saved === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export default function ChecklistPage() {
  const { userModels } = useAppData();
  const [scope, setScope] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [marketVisible, setMarketVisible] = useState(readMarketVisible);

  useEffect(() => {
    if (scope?.type !== 'strategy') return;
    if (!userModels.some((m) => m.id === scope.id)) setScope(null);
  }, [scope, userModels]);

  useEffect(() => {
    try {
      localStorage.setItem(MARKET_VISIBLE_KEY, marketVisible ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [marketVisible]);

  const entryModelId = scope?.type === 'strategy' ? scope.id : null;

  const title = useMemo(() => {
    if (!scope) return 'Checklist';
    if (scope.type === 'general') return 'General';
    return userModels.find((m) => m.id === scope.id)?.name || scope.name || 'Strategy';
  }, [scope, userModels]);

  const subtitle = !scope
    ? 'Choose a strategy to run its checklist.'
    : scope.type === 'general'
      ? 'Steps not tied to a strategy.'
      : 'Complete before every session with this strategy.';

  function handleCreated(model) {
    setScope({ type: 'strategy', id: model.id, name: model.name });
  }

  if (!scope) {
    return (
      <div className={dashboardPageWideFull}>
        <header className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Checklist</h1>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        </header>

        <StrategyChecklistList
          onSelect={setScope}
          onCreate={() => setIsCreateOpen(true)}
        />

        <CreateStrategyModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      </div>
    );
  }

  return (
    <div className={dashboardPageWideFull}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <BackButton className="mb-2 -ml-2" onClick={() => setScope(null)} />
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!marketVisible ? (
            <button className={btnOutline} type="button" onClick={() => setMarketVisible(true)}>
              Show market
            </button>
          ) : null}
          <button className={btnOutline} type="button" onClick={() => setIsAiOpen(true)}>
            Generate with AI
          </button>
          <button className={btnPrimary} type="button" onClick={() => setIsModalOpen(true)}>
            + Add Step
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {marketVisible ? (
          <div className="flex min-h-[360px] min-w-0 flex-1 flex-col lg:min-h-0 lg:basis-[58%]">
            <MarketChartFrame onClose={() => setMarketVisible(false)} />
          </div>
        ) : null}
        <div
          className={`flex min-h-0 min-w-0 flex-col ${
            marketVisible ? 'flex-1 lg:max-w-[42%] lg:basis-[42%]' : 'h-full w-full flex-1'
          }`}
        >
          <ChecklistCard entryModelId={entryModelId} />
        </div>
      </div>

      <ChecklistStepModal
        isOpen={isModalOpen}
        entryModelId={entryModelId}
        onClose={() => setIsModalOpen(false)}
      />
      <AiChecklistSidebar
        isOpen={isAiOpen}
        entryModelId={entryModelId}
        onClose={() => setIsAiOpen(false)}
      />
    </div>
  );
}
