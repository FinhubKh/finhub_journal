import { useState } from 'react';
import ChecklistCard from '../components/journal/ChecklistCard';
import AddChecklistStepModal from '../components/modals/AddChecklistStepModal';
import { dashboardPageWideFull, btnPrimary } from '../lib/ui';

export default function ChecklistPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className={dashboardPageWideFull}>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Checklist</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Build consistency by completing your routine before every session.
          </p>
        </div>
        <button className={btnPrimary} type="button" onClick={() => setIsModalOpen(true)}>
          + Add Step
        </button>
      </header>
      
      <div className="flex min-h-0 flex-1 flex-col">
        <ChecklistCard />
      </div>

      <AddChecklistStepModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
