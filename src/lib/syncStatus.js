/** Shared copy + formatting for MetaTrader sync status across the app. */

/** Matches the bridge's AUTO_SYNC_INTERVAL_MINUTES default (finhubkh-mt5-bridge). */
export const AUTO_SYNC_HINT = 'auto-syncs every 3h';

// Prefix of the bridge's TERMINAL_ERROR_MSG / TERMINAL_VERIFY_ERROR_MSG (workers/mt5_worker.py).
const BRIDGE_RETRY_PREFIX = "Our sync server couldn't start MetaTrader";

/** True when the last error was the bridge's own terminal, which retries by itself. */
export function isAutoRetryError(error) {
  return String(error || '').startsWith(BRIDGE_RETRY_PREFIX);
}

/** "Just now" · "12m ago" · "3h ago" · "Yesterday" · "4d ago" · "Oct 3" — null if invalid. */
export function formatSyncAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const date = new Date(iso);
  const t = date.getTime();
  if (Number.isNaN(t)) return null;
  const diffMs = now - t;
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Full timestamp for tooltips. */
export function formatSyncExact(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
