// backend/api/__tests__/investor-connect-handler.test.mjs
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  handleConnectInvestorCredentials,
  handleInvestorVerifyStatus,
} from '../investor-connect-handler.mjs';

const KEY = 'a'.repeat(64);
const DEPS = {
  supabaseUrl: 'https://example.supabase.co',
  anonKey: 'anon-key',
  serviceKey: 'service-key',
  encryptionKey: KEY,
  bridgeUrl: 'https://bridge.internal',
  bridgeServiceToken: 'bridge-secret-token',
};

function makeReq(token, body, query = {}) {
  return { headers: { authorization: token ? `Bearer ${token}` : '' }, body, query };
}

describe('handleConnectInvestorCredentials', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects when no bearer token is present', async () => {
    const result = await handleConnectInvestorCredentials(makeReq(null, {}), DEPS);
    expect(result.status).toBe(401);
  });

  it('saves credentials, queues verify, and returns job_id', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'acct-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'cred-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ job_id: 'verify-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleConnectInvestorCredentials(
      makeReq('good-token', {
        trading_account_id: 'acct-1',
        broker_server: 'Broker-Live',
        login: '12345',
        investor_password: 'secret',
      }),
      DEPS,
    );

    expect(result.status).toBe(202);
    expect(result.body).toEqual({
      verifying: true,
      job_id: 'verify-1',
      trading_account_id: 'acct-1',
      broker_server: 'Broker-Live',
      login: '12345',
    });
    expect(fetchMock.mock.calls[3][0]).toBe('https://bridge.internal/jobs/verify');
    const verifyBody = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(verifyBody).toEqual({
      trading_account_id: 'acct-1',
      login: '12345',
      password: 'secret',
      server: 'Broker-Live',
    });
  });

  it('deletes credentials and returns 502 when bridge verify enqueue fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'acct-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'cred-1' }] })
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleConnectInvestorCredentials(
      makeReq('good-token', {
        trading_account_id: 'acct-1',
        broker_server: 'Broker-Live',
        login: '12345',
        investor_password: 'secret',
      }),
      DEPS,
    );

    expect(result.status).toBe(502);
    expect(result.body.error).toMatch(/verify/i);
  });
});

describe('handleInvestorVerifyStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns pending while bridge result is pending', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ trading_account_id: 'acct-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'pending' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleInvestorVerifyStatus(
      makeReq('good-token', null, { job_id: 'verify-1', trading_account_id: 'acct-1' }),
      DEPS,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'pending' });
  });

  it('returns ok on successful verify', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ trading_account_id: 'acct-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'done', ok: true, trading_account_id: 'acct-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleInvestorVerifyStatus(
      makeReq('good-token', null, { job_id: 'verify-1', trading_account_id: 'acct-1' }),
      DEPS,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('deletes credentials and returns failed on login rejection', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ trading_account_id: 'acct-1' }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'done',
          ok: false,
          error: 'Login failed — check broker server, MT5 login, and investor password',
        }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleInvestorVerifyStatus(
      makeReq('good-token', null, { job_id: 'verify-1', trading_account_id: 'acct-1' }),
      DEPS,
    );
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('failed');
    expect(result.body.error).toMatch(/broker server/i);
    expect(fetchMock.mock.calls[3][1].method).toBe('DELETE');
  });
});
