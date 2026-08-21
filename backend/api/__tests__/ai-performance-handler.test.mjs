// backend/api/__tests__/ai-performance-handler.test.mjs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { embedText, retrieveJournalContext, handlePerformanceStats, handlePerformanceChat } from '../ai-performance-handler.mjs';

const DEPS = {
  supabaseUrl: 'https://example.supabase.co',
  anonKey: 'anon-key',
  embedFunctionSecret: 'embed-secret',
};

function makeAccessToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('embedText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to the embed function in query mode and returns the vector', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embedding: [0.1, 0.2] }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedText({ supabaseUrl: DEPS.supabaseUrl, embedSecret: DEPS.embedFunctionSecret, text: 'why did I lose' });

    expect(result).toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/embed',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-embed-secret': 'embed-secret' }),
      }),
    );
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ mode: 'query', content: 'why did I lose' });
  });

  it('returns null when the embed function errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await embedText({ supabaseUrl: DEPS.supabaseUrl, embedSecret: DEPS.embedFunctionSecret, text: 'x' });
    expect(result).toBeNull();
  });

  it('returns null when the response body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    }));
    const result = await embedText({ supabaseUrl: DEPS.supabaseUrl, embedSecret: DEPS.embedFunctionSecret, text: 'x' });
    expect(result).toBeNull();
  });

  it('returns null when the response has no embedding array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notEmbedding: true }) }));
    const result = await embedText({ supabaseUrl: DEPS.supabaseUrl, embedSecret: DEPS.embedFunctionSecret, text: 'x' });
    expect(result).toBeNull();
  });
});

describe('retrieveJournalContext', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('embeds the query then calls the match RPC with the user token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.1, 0.2] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ source_type: 'trade', content: 'chased entry', metadata: { date: '2026-07-14' }, similarity: 0.9 }]) });
    vi.stubGlobal('fetch', fetchMock);

    const rows = await retrieveJournalContext({
      ...DEPS,
      accessToken: 'user-token',
      accountId: 'acct-1',
      queryText: 'why did I lose in london',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });

    expect(rows).toEqual([{ source_type: 'trade', content: 'chased entry', metadata: { date: '2026-07-14' }, similarity: 0.9 }]);
    const rpcCall = fetchMock.mock.calls[1];
    expect(rpcCall[0]).toBe('https://example.supabase.co/rest/v1/rpc/match_journal_embeddings');
    expect(rpcCall[1].headers.Authorization).toBe('Bearer user-token');
    expect(JSON.parse(rpcCall[1].body)).toEqual({
      p_account_id: 'acct-1',
      p_query_embedding: [0.1, 0.2],
      p_from: '2026-07-01',
      p_to: '2026-07-31',
      p_match_count: 8,
    });
  });

  it('returns an empty array without calling the RPC when embedding is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const rows = await retrieveJournalContext({ ...DEPS, embedFunctionSecret: '', accessToken: 't', accountId: 'a', queryText: 'q' });
    expect(rows).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty array (not a throw) when the RPC call fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.1] }) })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const rows = await retrieveJournalContext({ ...DEPS, accessToken: 't', accountId: 'a', queryText: 'q' });
    expect(rows).toEqual([]);
  });

  it('returns an empty array when embedding the query itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const rows = await retrieveJournalContext({ ...DEPS, accessToken: 't', accountId: 'a', queryText: 'q' });
    expect(rows).toEqual([]);
  });

  it('returns an empty array when the RPC responds with a non-array body', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.1] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ unexpected: 'shape' }) });
    vi.stubGlobal('fetch', fetchMock);
    const rows = await retrieveJournalContext({ ...DEPS, accessToken: 't', accountId: 'a', queryText: 'q' });
    expect(rows).toEqual([]);
  });
});

describe('handlePerformanceStats', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a zeroed summary (not an error) when there are no trades in range', async () => {
    const token = makeAccessToken('user-1');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'acct-1', name: 'Main' }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([]) });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { account_id: 'acct-1', from: '2026-07-01', to: '2026-07-31' },
    };
    const result = await handlePerformanceStats(req, DEPS);

    expect(result.status).toBe(200);
    expect(result.body.summary.trade_count).toBe(0);
    expect(result.body.summary.sharpe).toBeNull();
  });
});

describe('handlePerformanceChat with retrieval + persistence', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retrieves journal context, sends it to SEA-LION, and persists both messages', async () => {
    const token = makeAccessToken('user-1');
    const fetchMock = vi.fn()
      // fetchAccountAndTrades: account, trades
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'acct-1', name: 'Main' }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ date: '2026-07-14', result: 'loss', r_value: -1, pnl_usd: -100, session: 'london', symbol: 'XAUUSD', direction: 'buy', model: 'A' }]) })
      // embedText (query mode)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: [0.1] }) })
      // match_journal_embeddings RPC
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ source_type: 'trade', content: 'chased entry after news spike', metadata: { date: '2026-07-14', symbol: 'XAUUSD' }, similarity: 0.9 }]) })
      // SEA-LION chat completion
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Your 07/14 XAUUSD loss notes cite chasing entry after a news spike.' }) } }] }) })
      // persist user message
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'm1' }]) })
      // persist assistant message
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'm2' }]) });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: {
        account_id: 'acct-1',
        from: '2026-07-01',
        to: '2026-07-31',
        message: 'why did I lose on gold in london',
      },
    };
    const result = await handlePerformanceChat(req, { ...DEPS, sealionApiKey: 'sk-1' });

    expect(result.status).toBe(200);
    expect(result.body.reply).toContain('chasing entry');

    const rpcCall = fetchMock.mock.calls[3];
    expect(rpcCall[0]).toBe('https://example.supabase.co/rest/v1/rpc/match_journal_embeddings');

    const sealionCall = fetchMock.mock.calls[4];
    const sealionPayload = JSON.parse(sealionCall[1].body);
    expect(sealionPayload.messages[1].content).toContain('chased entry after news spike');

    const persistUserCall = fetchMock.mock.calls[5];
    expect(persistUserCall[0]).toBe('https://example.supabase.co/rest/v1/ai_chat_messages');
    expect(JSON.parse(persistUserCall[1].body)).toMatchObject({ role: 'user', content: 'why did I lose on gold in london', account_id: 'acct-1' });

    const persistAssistantCall = fetchMock.mock.calls[6];
    expect(JSON.parse(persistAssistantCall[1].body)).toMatchObject({ role: 'assistant', account_id: 'acct-1' });
  });

  it('still replies from stats alone when retrieval finds nothing', async () => {
    const token = makeAccessToken('user-1');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'acct-1', name: 'Main' }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ date: '2026-07-14', result: 'loss', r_value: -1, pnl_usd: -100 }]) })
      .mockResolvedValueOnce({ ok: false }) // embed fails
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Stats-only answer.' }) } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'm1' }]) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ id: 'm2' }]) });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { account_id: 'acct-1', from: '2026-07-01', to: '2026-07-31', message: 'how is my win rate' },
    };
    const result = await handlePerformanceChat(req, { ...DEPS, sealionApiKey: 'sk-1' });

    expect(result.status).toBe(200);
    expect(result.body.reply).toBe('Stats-only answer.');
  });
});
