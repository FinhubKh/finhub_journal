import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleSaveInvestorCredentials } from '../investor-credentials-handler.mjs';

const DEPS = {
  supabaseUrl: 'https://example.supabase.co',
  anonKey: 'anon-key',
  serviceKey: 'service-key',
  encryptionKey: 'a'.repeat(64),
};

function makeReq(token, body) {
  return { headers: { authorization: token ? `Bearer ${token}` : '' }, body };
}

describe('handleSaveInvestorCredentials', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects when no bearer token is present', async () => {
    const req = makeReq(null, {});
    const result = await handleSaveInvestorCredentials(req, DEPS);
    expect(result.status).toBe(401);
  });

  it('rejects when the supabase user lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const req = makeReq('bad-token', {});
    const result = await handleSaveInvestorCredentials(req, DEPS);
    expect(result.status).toBe(401);
  });

  it('rejects when required fields are missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'user-1' }) }));
    const req = makeReq('good-token', {});
    const result = await handleSaveInvestorCredentials(req, DEPS);
    expect(result.status).toBe(400);
  });

  it('rejects when the trading account does not belong to the user', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq('good-token', {
      trading_account_id: 'acct-1', broker_server: 'Broker-Live', login: '12345', investor_password: 'secret',
    });
    const result = await handleSaveInvestorCredentials(req, DEPS);
    expect(result.status).toBe(404);
  });

  it('encrypts the password and upserts credentials on success', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'acct-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'cred-1' }] });
    vi.stubGlobal('fetch', fetchMock);

    const req = makeReq('good-token', {
      trading_account_id: 'acct-1', broker_server: 'Broker-Live', login: '12345', investor_password: 'secret',
    });
    const result = await handleSaveInvestorCredentials(req, DEPS);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, broker_server: 'Broker-Live', login: '12345' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const upsertCall = fetchMock.mock.calls[2];
    const sentRow = JSON.parse(upsertCall[1].body)[0];
    expect(sentRow.encrypted_password).not.toBe('secret');
  });
});
