import { useMemo } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { card } from '../../lib/ui';

function StrategyIcon({ general = false }) {
  if (general) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 11.5L6.5 8l2.5 2.5L13 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 4.5h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function StrategyCard({ title, subtitle, stepCount, onClick, general = false }) {
  return (
    <button
      type="button"
      className={`${card} group flex h-full w-full flex-col gap-4 p-4 text-left transition hover:border-violet-300 hover:shadow-sm dark:hover:border-violet-700 md:p-5`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <StrategyIcon general={general} />
        <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {stepCount} {stepCount === 1 ? 'step' : 'steps'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
      <span className="text-xs font-medium text-violet-600 opacity-0 transition group-hover:opacity-100 dark:text-violet-400">
        Open checklist
      </span>
    </button>
  );
}

export default function StrategyChecklistList({ onSelect, onCreate }) {
  const { userModels, userSteps } = useAppData();

  const counts = useMemo(() => {
    const map = { general: 0 };
    userSteps.forEach((s) => {
      if (!s.entry_model_id) {
        map.general += 1;
        return;
      }
      map[s.entry_model_id] = (map[s.entry_model_id] || 0) + 1;
    });
    return map;
  }, [userSteps]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StrategyCard
          general
          title="General"
          subtitle="Not tied to a strategy"
          stepCount={counts.general}
          onClick={() => onSelect({ type: 'general' })}
        />

        {userModels.map((model) => (
          <StrategyCard
            key={model.id}
            title={model.name}
            subtitle="Strategy checklist"
            stepCount={counts[model.id] || 0}
            onClick={() => onSelect({ type: 'strategy', id: model.id, name: model.name })}
          />
        ))}

        <button
          type="button"
          className="flex min-h-[148px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-5 text-sm font-semibold text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/20 dark:hover:text-violet-300"
          onClick={onCreate}
        >
          <span className="text-lg leading-none">+</span>
          Create strategy
        </button>
      </div>
    </div>
  );
}
