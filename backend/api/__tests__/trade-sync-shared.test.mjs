import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolvePnlUsd, sessionFromTime, tradesToRows, upsertSyncedTrades } from '../trade-sync-shared.mjs';

describe('resolvePnlUsd', () => {
  it('uses pnl_raw as-is for cent accounts on EA sync (source api)', () => {
    const pnl = resolvePnlUsd({ pnl_raw: 1000 }, { pnl_denomination: 'cent' }, 'api');
    expect(pnl).toBe(1000);
  });

  it('scales USD dollars to Cents (*100) for cent accounts on investor_bridge sync', () => {
    const pnl = resolvePnlUsd({ pnl_usd: 54.83 }, { pnl_denomination: 'cent' }, 'investor_bridge');
    expect(pnl).toBe(5483);
  });

  it('uses pnl_raw as-is for usd accounts', () => {
    const pnl = resolvePnlUsd({ pnl_raw: 42.5 }, { pnl_denomination: 'usd' }, 'investor_bridge');
    expect(pnl).toBe(42.5);
  });

  it('falls back to pnl_usd when pnl_raw is absent', () => {
    const pnl = resolvePnlUsd({ pnl_usd: 7 }, { pnl_denomination: 'usd' }, 'api');
    expect(pnl).toBe(7);
  });
});

describe('sessionFromTime', () => {
  it('maps UTC hours to asian / london / ny', () => {
    expect(sessionFromTime('2026-08-17T02:15:00Z')).toBe('asian');
    expect(sessionFromTime('2026-08-17T08:00:00Z')).toBe('london');
    expect(sessionFromTime('2026-08-17T14:30:00Z')).toBe('ny');
    expect(sessionFromTime('2026-08-17T22:00:00Z')).toBe('asian');
    expect(sessionFromTime(null)).toBeNull();
  });
});

describe('tradesToRows', () => {
  it('tags each row with the given source and account', () => {
    const rows = tradesToRows(
      [{ ticket: 1, symbol: 'EURUSD', pnl_usd: 5 }],
      'user-1',
      { id: 'acct-1', name: 'Live', pnl_denomination: 'usd' },
      'investor_bridge',
    );
    expect(rows).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        source: 'investor_bridge',
        account_id: 'acct-1',
        account: 'Live',
        result: 'win',
      }),
    ]);
  });

  it('derives session from open_time when the payload omits it', () => {
    const rows = tradesToRows(
      [{ ticket: 1, pnl_usd: 5, open_time: '2026-08-17T08:30:00Z' }],
      'user-1',
      { id: 'acct-1', name: 'Live', pnl_denomination: 'usd' },
      'api',
    );
    expect(rows[0].session).toBe('london');
  });
});

describe('upsertSyncedTrades', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts mapped rows to the trades upsert endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 't1' }] });
    vi.stubGlobal('fetch', fetchMock);

    const saved = await upsertSyncedTrades({
      trades: [{ ticket: 1, pnl_usd: 5 }],
      userId: 'user-1',
      matchedAccount: { id: 'acct-1', name: 'Live', pnl_denomination: 'usd' },
      source: 'investor_bridge',
      supabaseUrl: 'https://example.supabase.co',
      serviceKey: 'service-key',
    });

    expect(saved).toEqual([{ id: 't1' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/trades?on_conflict=account_id,ticket',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('upserts trades in chunks of 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 't' }] });
    vi.stubGlobal('fetch', fetchMock);

    const trades = Array.from({ length: 201 }, (_, i) => ({ ticket: i + 1, pnl_usd: 1 }));
    await upsertSyncedTrades({
      trades,
      userId: 'user-1',
      matchedAccount: { id: 'acct-1', name: 'Live', pnl_denomination: 'usd' },
      source: 'api',
      supabaseUrl: 'https://example.supabase.co',
      serviceKey: 'service-key',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toHaveLength(200);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toHaveLength(1);
  });

  it('throws when the upsert request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => 'db error' }));

    await expect(
      upsertSyncedTrades({
        trades: [{ ticket: 1 }],
        userId: 'user-1',
        matchedAccount: { id: 'acct-1', name: 'Live' },
        source: 'api',
        supabaseUrl: 'https://example.supabase.co',
        serviceKey: 'service-key',
      }),
    ).rejects.toThrow('db error');
  });
});
