import { describe, expect, it } from 'vitest';
import { formatSyncAgo, isAutoRetryError } from './syncStatus.js';

const NOW = Date.parse('2026-10-24T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

describe('formatSyncAgo', () => {
  it('formats recent syncs relatively', () => {
    expect(formatSyncAgo(ago(20_000), NOW)).toBe('Just now');
    expect(formatSyncAgo(ago(12 * 60_000), NOW)).toBe('12m ago');
    expect(formatSyncAgo(ago(3 * 3_600_000), NOW)).toBe('3h ago');
    expect(formatSyncAgo(ago(30 * 3_600_000), NOW)).toBe('Yesterday');
    expect(formatSyncAgo(ago(4 * 86_400_000), NOW)).toBe('4d ago');
  });

  it('falls back to a short date after a week', () => {
    expect(formatSyncAgo(ago(20 * 86_400_000), NOW)).toMatch(/Oct|4/);
  });

  it('treats a slightly-future timestamp (clock skew) as just now', () => {
    expect(formatSyncAgo(new Date(NOW + 5_000).toISOString(), NOW)).toBe('Just now');
  });

  it('returns null for missing or invalid input', () => {
    expect(formatSyncAgo(null, NOW)).toBeNull();
    expect(formatSyncAgo('not-a-date', NOW)).toBeNull();
  });
});

describe('isAutoRetryError', () => {
  it('detects bridge-side terminal errors', () => {
    expect(isAutoRetryError("Our sync server couldn't start MetaTrader — this isn't a problem with your login. It will retry automatically (IPC timeout)")).toBe(true);
  });

  it('does not flag credential errors', () => {
    expect(isAutoRetryError('Login failed — check broker server, MetaTrader login, and investor password')).toBe(false);
    expect(isAutoRetryError(null)).toBe(false);
  });
});
