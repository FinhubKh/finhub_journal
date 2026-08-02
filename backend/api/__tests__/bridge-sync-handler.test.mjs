import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleBridgeSync } from '../bridge-sync-handler.mjs';

const DEPS = {
  supabaseUrl: 'https://example.supabase.co',
  serviceKey: 'service-key',
  bridgeServiceToken: 'bridge-secret-token',
};

function makeReq(token, body) {
  return { headers: { 'x-bridge-token': token }, body };
}

describe('handleBridgeSync', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects requests with the wrong bridge token', async () => {
    const req = makeReq('wrong-token', { trading_account_id: 'a', trades: [{ ticket: 1 }] });
    const result = await handleBridgeSync(req, DEPS);
    expect(result.status).toBe(401);
  });

  it('rejects when BRIDGE_SERVICE_TOKEN is unset and no token header is sent', async () => {
    const req = makeReq(undefined, { trading_account_id: 'a', trades: [{ ticket: 1 }] });
    const result = await handleBridgeSync(req, { ...DEPS, bridgeServiceToken: undefined });
    expect(result.status).toBe(401);
  });

  it('rejects when the trades array is empty', async () => {
    const req = makeReq('bridge-secret-token', { trading_account_id: 'a', trades: [] });
    const result = await handleBridgeSync(req, DEPS);
    expect(result.status).toBe(400);
  });

  it('rejects when the trading account does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const req = makeReq('bridge-secret-token', { trading_account_id: 'missing', trades: [{ ticket: 1 }] });
    const result = await handleBridgeSync(req, DEPS);
    expect(result.status).toBe(404);
  });

  it('upserts trades and marks the account synced on success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'acct-1', user_id: 'user-1', name: 'Live', pnl_denomination: 'usd' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'trade-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq('bridge-secret-token', {
      trading_account_id: 'acct-1',
      trades: [{ ticket: 1, symbol: 'EURUSD', pnl_usd: 10 }],
    });
    const result = await handleBridgeSync(req, DEPS);

    expect(result.status).toBe(200);
    expect(result.body.received).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('records a job failure reported by the bridge instead of trades', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq('bridge-secret-token', {
      trading_account_id: 'acct-1',
      error: 'Invalid investor credentials',
    });
    const result = await handleBridgeSync(req, DEPS);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ acknowledged: true, error_recorded: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const patchCall = fetchMock.mock.calls[0];
    expect(patchCall[0]).toContain('investor_credentials?trading_account_id=eq.acct-1');
    expect(JSON.parse(patchCall[1].body)).toEqual({ last_sync_error: 'Invalid investor credentials' });
  });
});
