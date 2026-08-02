// backend/api/__tests__/investor-sync-handler.test.mjs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleTriggerInvestorSync } from '../investor-sync-handler.mjs';
import { encryptSecret } from '../crypto-helper.mjs';

const KEY = 'a'.repeat(64);
const DEPS = {
  supabaseUrl: 'https://example.supabase.co',
  anonKey: 'anon-key',
  serviceKey: 'service-key',
  encryptionKey: KEY,
  bridgeUrl: 'https://bridge.internal',
  bridgeServiceToken: 'bridge-secret-token',
};

function makeReq(token, body) {
  return { headers: { authorization: `Bearer ${token}` }, body };
}

describe('handleTriggerInvestorSync', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects unauthenticated requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const req = makeReq('bad-token', { trading_account_id: 'acct-1' });
    const result = await handleTriggerInvestorSync(req, DEPS);
    expect(result.status).toBe(401);
  });

  it('returns 404 when no credentials are configured', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    const req = makeReq('good-token', { trading_account_id: 'acct-1' });
    const result = await handleTriggerInvestorSync(req, DEPS);
    expect(result.status).toBe(404);
  });

  it('decrypts credentials and forwards a job to the bridge', async () => {
    const encrypted = encryptSecret('investor-pass', KEY);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ broker_server: 'Broker-Live', login: '12345', encrypted_password: encrypted }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'job-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq('good-token', { trading_account_id: 'acct-1' });
    const result = await handleTriggerInvestorSync(req, DEPS);

    expect(result.status).toBe(202);
    expect(result.body).toEqual({ queued: true, job_id: 'job-1' });
    const bridgeCall = fetchMock.mock.calls[2];
    expect(bridgeCall[0]).toBe('https://bridge.internal/jobs/sync');
    expect(JSON.parse(bridgeCall[1].body)).toEqual({
      trading_account_id: 'acct-1',
      login: '12345',
      password: 'investor-pass',
      server: 'Broker-Live',
    });
  });

  it('returns 502 when the bridge is unreachable', async () => {
    const encrypted = encryptSecret('investor-pass', KEY);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ broker_server: 'Broker-Live', login: '12345', encrypted_password: encrypted }] })
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq('good-token', { trading_account_id: 'acct-1' });
    const result = await handleTriggerInvestorSync(req, DEPS);
    expect(result.status).toBe(502);
  });
});
