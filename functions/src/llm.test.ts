import { afterEach, describe, expect, it, vi } from 'vitest';
import { GemmaProvider, LlmConfigError, LlmError, LlmQuotaError, LlmTimeoutError } from './llm';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (text: string) => json(200, { candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text }] } }] });
const apiError = (status: number, statusText: string, message = 'x', details: unknown[] = []) =>
  json(status, { error: { code: status, status: statusText, message, details } });

const provider = (opts = {}) => new GemmaProvider('test-key', 'gemma-test', { backoffMs: 1, ...opts });
const req = { system: 's', user: 'u' };

function mockFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockImplementationOnce(async () => (r instanceof Error ? Promise.reject(r) : r));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('GemmaProvider error handling', () => {
  it('returns the final answer without thinking parts', async () => {
    mockFetch(ok('Odpowiedź'));
    await expect(provider().generate(req)).resolves.toBe('Odpowiedź');
  });

  it('missing key → config error, no request sent', async () => {
    const f = mockFetch();
    await expect(new GemmaProvider('  ').generate(req)).rejects.toBeInstanceOf(LlmConfigError);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ['429 rate limit', apiError(429, 'RESOURCE_EXHAUSTED')],
    ['402 depleted credits', apiError(402, 'RESOURCE_EXHAUSTED', 'Your prepayment credits are depleted.')],
  ])('%s → quota error (docs/03 § 1), no retry', async (_, res) => {
    const f = mockFetch(res);
    await expect(provider().generate(req)).rejects.toBeInstanceOf(LlmQuotaError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['403 permission denied', apiError(403, 'PERMISSION_DENIED', 'Permission denied on the service.')],
    ['401 unauthenticated', apiError(401, 'UNAUTHENTICATED')],
    ['404 unknown model', apiError(404, 'NOT_FOUND')],
    ['400 invalid key', apiError(400, 'INVALID_ARGUMENT', 'API key not valid.', [{ reason: 'API_KEY_INVALID' }])],
  ])('%s → config error, no retry', async (_, res) => {
    const f = mockFetch(res);
    const err = await provider().generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(LlmConfigError);
    expect(err.message).toContain('gemma-test');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('400 other than a key problem → generic, not retried', async () => {
    const f = mockFetch(apiError(400, 'INVALID_ARGUMENT', 'Request too large'));
    const err = await provider().generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err).not.toBeInstanceOf(LlmConfigError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('retries transient 503 / network errors and succeeds', async () => {
    const f = mockFetch(apiError(503, 'UNAVAILABLE', 'The model is overloaded.'), new TypeError('fetch failed'), ok('OK'));
    await expect(provider().generate(req)).resolves.toBe('OK');
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('gives up after the configured retries', async () => {
    const f = mockFetch(apiError(503, 'UNAVAILABLE'), apiError(503, 'UNAVAILABLE'), apiError(503, 'UNAVAILABLE'));
    const err = await provider({ retries: 2 }).generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.message).toContain('503');
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('does not retry when the time budget is too short', async () => {
    const f = mockFetch(apiError(503, 'UNAVAILABLE'), ok('late'));
    await expect(provider({ budgetMs: 5_000 }).generate(req)).rejects.toBeInstanceOf(LlmError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('timeout → timeout error, not retried', async () => {
    const abort = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const f = mockFetch(abort);
    await expect(provider().generate(req)).rejects.toBeInstanceOf(LlmTimeoutError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('empty / blocked answer reports the reason', async () => {
    mockFetch(json(200, { promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(provider().generate(req)).rejects.toThrow(/SAFETY/);
  });
});
