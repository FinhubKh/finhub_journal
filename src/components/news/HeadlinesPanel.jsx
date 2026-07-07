import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMarketNews } from '../../api/market';
import { ErrorBlock, formatRelativeTime, LoadingBlock, newsFrame } from './marketNewsShared';
import {
  emptyState,
  pillBtn,
  pillToggle,
} from '../../lib/ui';

const NEWS_REFRESH_MS = 2 * 60 * 1000;
const FEATURED_COUNT = 4;

export const NEWS_CATEGORY_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'world', label: 'World' },
  { id: 'market', label: 'Market' },
];

export function NewsCategoryFilter({ value, onChange }) {
  return (
    <div className={`${pillToggle} rounded-none`}>
      {NEWS_CATEGORY_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`${pillBtn(value === option.id)} rounded-none`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function formatPublishDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NewsImage({ article, className = '', imgClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const showImage = article.imageUrl && !failed;

  return (
    <div className={`overflow-hidden bg-zinc-100 ${className}`}>
      {showImage ? (
        <img
          src={article.imageUrl}
          alt=""
          className={`h-full w-full object-cover ${imgClassName}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-100 via-zinc-100 to-amber-50">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {article.source?.slice(0, 3) || 'News'}
          </span>
        </div>
      )}
    </div>
  );
}

function FeaturedNewsCard({ article }) {
  return (
    <article className={`${newsFrame} flex h-full flex-col overflow-hidden`}>
      <NewsImage article={article} className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
          <span className="inline-flex h-5 w-5 items-center justify-center bg-violet-100 text-[10px] font-bold uppercase">
            {article.source?.slice(0, 1) || 'N'}
          </span>
          <span>{article.source}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-bold leading-snug text-zinc-900">
          {article.title}
        </h3>
        {article.publishedAt ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {formatPublishDate(article.publishedAt)}
          </p>
        ) : null}
        {article.description ? (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-zinc-600">
            {article.description}
          </p>
        ) : null}
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-semibold text-teal-600 hover:text-teal-700"
        >
          View More &raquo;
        </a>
      </div>
    </article>
  );
}

function NewsListRow({ article }) {
  return (
    <article className="flex gap-3 border-b border-zinc-100 py-4 last:border-b-0">
      <NewsImage article={article} className="h-20 w-20 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-zinc-900">
          <a href={article.link} target="_blank" rel="noreferrer" className="hover:text-violet-700">
            {article.title}
          </a>
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
          {article.publishedAt ? (
            <span className="inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {formatPublishDate(article.publishedAt)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-zinc-500">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6 6h4M6 9h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {article.source}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function HeadlinesPanel({ categoryFilter = 'all', className = '' }) {
  const [articles, setArticles] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchMarketNews(40);
      setArticles(data.articles || []);
      setUpdatedAt(data.updatedAt || null);
      setSources(data.sources || []);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load news');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), NEWS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const filteredArticles = useMemo(
    () => articles.filter((article) => categoryFilter === 'all' || article.category === categoryFilter),
    [articles, categoryFilter],
  );

  const featuredArticles = filteredArticles.slice(0, FEATURED_COUNT);
  const listArticles = filteredArticles.slice(FEATURED_COUNT);

  if (loading) return <LoadingBlock label="Loading headlines..." frameClass={newsFrame} />;
  if (error) return <ErrorBlock message={error} onRetry={() => load()} frameClass={newsFrame} />;

  return (
    <div className={`flex min-h-0 flex-col gap-4 ${className}`}>
      {filteredArticles.length === 0 ? (
        <div className={`${newsFrame} ${emptyState}`}>
          <p>No headlines match this filter.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-stretch">
          <section className="min-h-0 overflow-y-auto">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-500">Latest</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {featuredArticles.map((article) => (
                <FeaturedNewsCard key={article.id} article={article} />
              ))}
            </div>
          </section>

          <aside className={`${newsFrame} flex h-full min-h-0 flex-col overflow-hidden`}>
            <div className="border-b border-zinc-100 px-4 py-3.5 md:px-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">More headlines</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 md:px-5">
              {listArticles.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No additional headlines.</p>
              ) : (
                listArticles.map((article) => <NewsListRow key={article.id} article={article} />)
              )}
            </div>
          </aside>
        </div>
      )}

      <p className="shrink-0 text-[11px] text-zinc-400">
        Sources: {sources.join(', ')}
        {updatedAt ? ` · updated ${formatRelativeTime(updatedAt)}` : ''}
      </p>
    </div>
  );
}
