import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolvePnlUsd, tradesToRows, upsertSyncedTrades } from '../trade-sync-shared.mjs';

describe('resolvePnlUsd', () => {
  it('uses pnl_raw as-is for cent accounts', () => {
    const pnl = resolvePnlUsd({ pnl_raw: 1000 }, { pnl_denomination: 'cent' });
    expect(pnl).toBe(1000);
  });

  it('uses pnl_raw as-is for usd accounts', () => {
    const pnl = resolvePnlUsd({ pnl_raw: 42.5 }, { pnl_denomination: 'usd' });
    expect(pnl).toBe(42.5);
  });

  it('falls back to pnl_usd when pnl_raw is absent', () => {
    const pnl = resolvePnlUsd({ pnl_usd: 7 }, { pnl_denomination: 'usd' });
    expect(pnl).toBe(7);
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
      'https://example.supabase.co/rest/v1/trades?on_conflict=user_id,ticket',
      expect.objectContaining({ method: 'POST' }),
    );
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
