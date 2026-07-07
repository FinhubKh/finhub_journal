import { useState } from 'react';
import HeadlinesPanel, { NewsCategoryFilter } from '../components/news/HeadlinesPanel';
import { dashboardPageWideFull } from '../lib/ui';

export default function WorldNewsPage() {
  const [categoryFilter, setCategoryFilter] = useState('world');

  return (
    <div className={`${dashboardPageWideFull} min-h-0`}>
      <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">World news</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Geopolitical and global headlines that can affect risk sentiment and prices.
          </p>
        </div>
        <NewsCategoryFilter value={categoryFilter} onChange={setCategoryFilter} />
      </header>
      <HeadlinesPanel categoryFilter={categoryFilter} className="min-h-0 flex-1" />
    </div>
  );
}
