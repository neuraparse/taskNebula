/**
 * High-level smoke tests for the HTTP handler. We exercise the
 * JSON-RPC discovery surface without depending on the MCP SDK runtime
 * (the handler short-circuits its own JSON-RPC dispatch).
 */
import { createMcpHttpHandler } from '../http';

// Install a fetch shim so the handler's underlying client can mock REST.
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test', ...headers },
    body: JSON.stringify(body),
  });
}

describe('createMcpHttpHandler', () => {
  const handler = createMcpHttpHandler({
    env: { TASKNEBULA_API_URL: 'https://api.test' } as NodeJS.ProcessEnv,
  });

  it('serves discovery JSON on GET', async () => {
    const res = await handler(new Request('http://localhost/api/mcp', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transport).toBe('http+jsonrpc');
    expect(body.authorization.flow).toBe('oauth2.1-pkce');
  });

  it('rejects requests without Authorization', async () => {
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it('responds to initialize', async () => {
    const res = await handler(jsonReq({ jsonrpc: '2.0', id: 1, method: 'initialize' }));
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe('@tasknebula/mcp-server');
  });

  it('lists 12 tools', async () => {
    const res = await handler(jsonReq({ jsonrpc: '2.0', id: 2, method: 'tools/list' }));
    const body = await res.json();
    expect(body.result.tools).toHaveLength(12);
  });

  it('returns Method not found for unknown method', async () => {
    const res = await handler(jsonReq({ jsonrpc: '2.0', id: 3, method: 'nope/foo' }));
    const body = await res.json();
    expect(body.error.code).toBe(-32601);
  });
});
