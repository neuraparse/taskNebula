import { TaskNebulaClient, TaskNebulaApiError } from '../client';

describe('TaskNebulaClient', () => {
  it('sends X-API-Key when only apiKey is set', async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      captured = init;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const c = new TaskNebulaClient({
      apiUrl: 'https://api.test',
      apiKey: 'k',
      fetchImpl,
    });
    await c.get('/api/ping');
    const headers = captured!.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('k');
    expect(headers.Authorization).toBe('Bearer k');
  });

  it('prefers OAuth accessToken over apiKey', async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      captured = init;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const c = new TaskNebulaClient({
      apiUrl: 'https://api.test',
      apiKey: 'k',
      accessToken: 'oauth-tok',
      fetchImpl,
    });
    await c.get('/api/ping');
    const headers = captured!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer oauth-tok');
    expect(headers['X-API-Key']).toBeUndefined();
  });

  it('throws TaskNebulaApiError on non-2xx', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 'nope' }), { status: 404, statusText: 'Not Found' })) as unknown as typeof fetch;
    const c = new TaskNebulaClient({ apiUrl: 'https://api.test', apiKey: 'k', fetchImpl });
    await expect(c.get('/api/missing')).rejects.toBeInstanceOf(TaskNebulaApiError);
  });

  it('serializes query params and skips undefined', async () => {
    let capturedUrl = '';
    const fetchImpl = (async (url: string) => {
      capturedUrl = url;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const c = new TaskNebulaClient({ apiUrl: 'https://api.test', apiKey: 'k', fetchImpl });
    await c.get('/api/things', { a: 1, b: undefined, c: 'x' });
    expect(capturedUrl).toContain('a=1');
    expect(capturedUrl).toContain('c=x');
    expect(capturedUrl).not.toContain('b=');
  });
});
