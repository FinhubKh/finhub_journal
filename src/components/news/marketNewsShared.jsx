import { btnOutline, card } from '../../lib/ui';

export const newsFrame = 'border border-zinc-200 bg-white';

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LoadingBlock({ label, frameClass = card }) {
  return (
    <div className={`${frameClass} flex items-center justify-center px-6 py-16 text-sm text-zinc-500`}>
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry, frameClass = card }) {
  return (
    <div className={`${frameClass} px-6 py-10 text-center`}>
      <p className="text-sm font-semibold text-rose-600">Could not load data</p>
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
      <button type="button" className={`${btnOutline} mt-5`} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
