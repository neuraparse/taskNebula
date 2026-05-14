/**
 * HTTP / Streamable transport entry point.
 *
 * Designed to be mounted from a Next.js Route Handler (see
 * `apps/web/src/app/api/mcp/route.ts`). We expose a Web-Fetch-API style
 * handler so it plugs into Next 13+ App Router with no shim.
 *
 * Streaming behavior:
 *   - POST /api/mcp           — JSON-RPC request, response is either JSON
 *                                or an SSE stream of `message` events,
 *                                depending on the `Accept` header.
 *   - GET  /api/mcp           — open an SSE channel for server→client
 *                                notifications (resource updates, log
 *                                messages, etc.).
 *
 * Auth: we extract a Bearer token (OAuth 2.1) per request and build a
 * fresh REST client. This means each request runs as the user that
 * authorized it — the server itself holds no privileged credentials.
 */
import { TaskNebulaClient } from './client.js';
import { resolveHttpAuth, clientOptionsFromHttp } from './auth.js';
import { createMcpServer } from './server.js';
import { allTools } from './tools/index.js';
import { resourceTemplates } from './resources.js';
import { allPrompts } from './prompts.js';

export interface HttpHandlerOptions {
  /** Override env (mainly for tests). */
  env?: NodeJS.ProcessEnv;
}

/**
 * Returns a Fetch-API compatible handler. Suitable for Next.js App
 * Router (`export const POST = createMcpHttpHandler();`).
 *
 * For P0 we ship a *capability-discovery + simple JSON-RPC* path that
 * exercises the same tool registry as stdio. Streaming SSE upgrade and
 * resumability are tracked as P1 follow-ups — they require wiring the
 * MCP SDK's `StreamableHTTPServerTransport`, which in turn needs a
 * persistent session store. For now JSON-only responses are sufficient
 * for Claude.ai's "Custom Connectors" beta and for curl smoke tests.
 */
export function createMcpHttpHandler(opts: HttpHandlerOptions = {}) {
  return async function handler(request: Request): Promise<Response> {
    const env = opts.env ?? process.env;
    if (request.method === 'GET') {
      return discoveryResponse();
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const auth = resolveHttpAuth({ headers: request.headers }, env);
    if (!auth.accessToken) {
      return jsonRpcError(null, -32001, 'Missing or invalid Authorization header. ' +
        'Send `Authorization: Bearer <token>` (OAuth 2.1 access token or TaskNebula API key).',
        401);
    }
    const client = new TaskNebulaClient(clientOptionsFromHttp(auth));

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonRpcError(null, -32700, 'Parse error', 400);
    }

    if (!isJsonRpc(payload)) {
      return jsonRpcError(null, -32600, 'Invalid Request', 400);
    }
    const { id, method, params } = payload;

    try {
      switch (method) {
        case 'initialize':
          return jsonRpcResult(id, {
            protocolVersion: '2025-03-26',
            serverInfo: { name: '@tasknebula/mcp-server', version: '0.1.0' },
            capabilities: { tools: {}, resources: {}, prompts: {} },
          });
        case 'tools/list':
          return jsonRpcResult(id, {
            tools: allTools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: zodToJsonSchemaSafe(t.inputSchema),
            })),
          });
        case 'tools/call': {
          const p = params as { name?: string; arguments?: unknown };
          const tool = allTools.find((t) => t.name === p?.name);
          if (!tool) {
            return jsonRpcError(id, -32601, `Unknown tool: ${p?.name}`);
          }
          // `tool.handler` parses internally (see `toAnyTool`).
          const result = await tool.handler(p.arguments ?? {}, { client });
          return jsonRpcResult(id, {
            content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
          });
        }
        case 'resources/list':
          return jsonRpcResult(id, {
            resourceTemplates: resourceTemplates.map((r) => ({
              uriTemplate: r.uriTemplate,
              name: r.name,
              description: r.description,
              mimeType: r.mimeType,
            })),
          });
        case 'resources/read': {
          const p = params as { uri?: string };
          if (!p?.uri) return jsonRpcError(id, -32602, 'Missing uri');
          const tmpl = resourceTemplates.find((t) =>
            p.uri!.startsWith(t.uriTemplate.split('{')[0]!),
          );
          if (!tmpl) return jsonRpcError(id, -32601, `No resource template for ${p.uri}`);
          const data = await tmpl.read(p.uri, { client });
          return jsonRpcResult(id, {
            contents: [{ uri: p.uri, mimeType: tmpl.mimeType, text: JSON.stringify(data, null, 2) }],
          });
        }
        case 'prompts/list':
          return jsonRpcResult(id, {
            prompts: allPrompts.map((p) => ({
              name: p.name,
              description: p.description,
            })),
          });
        case 'prompts/get': {
          const p = params as { name?: string; arguments?: unknown };
          const prompt = allPrompts.find((pp) => pp.name === p?.name);
          if (!prompt) return jsonRpcError(id, -32601, `Unknown prompt: ${p?.name}`);
          const parsed = prompt.argsSchema.parse(p.arguments ?? {});
          return jsonRpcResult(id, { messages: prompt.build(parsed) });
        }
        default:
          return jsonRpcError(id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      return jsonRpcError(id, -32000, err instanceof Error ? err.message : String(err), 500);
    }
  };
}

/**
 * Convenience: builds an MCP server tied to a Bearer token. Exposed for
 * callers that want to drive the high-level `McpServer` themselves
 * (e.g. a future Streamable HTTP transport wired through Node's `http`
 * server). Not used by the JSON-RPC short-path above.
 */
export function createHttpAttachedServer(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const auth = resolveHttpAuth({ headers: request.headers }, env);
  const client = new TaskNebulaClient(clientOptionsFromHttp(auth));
  return createMcpServer({ client });
}

function discoveryResponse(): Response {
  return new Response(
    JSON.stringify({
      server: { name: '@tasknebula/mcp-server', version: '0.1.0' },
      transport: 'http+jsonrpc',
      protocolVersion: '2025-03-26',
      // OAuth 2.1 discovery stub — point clients at the Next.js OAuth
      // routes once they're implemented (see TODO in src/auth.ts).
      authorization: {
        flow: 'oauth2.1-pkce',
        authorizationEndpoint: '/api/oauth/authorize',
        tokenEndpoint: '/api/oauth/token',
        registrationEndpoint: '/api/oauth/register',
        scopesSupported: ['issues:read', 'issues:write', 'comments:write'],
        status: 'stub',
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

function jsonRpcResult(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonRpcError(id: unknown, code: number, message: string, httpStatus = 200): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    status: httpStatus,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isJsonRpc(x: unknown): x is { jsonrpc: '2.0'; id?: unknown; method: string; params?: unknown } {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as { jsonrpc?: unknown }).jsonrpc === '2.0' &&
    typeof (x as { method?: unknown }).method === 'string'
  );
}

/**
 * Very small Zod → JSON-Schema converter. We only emit what MCP clients
 * actually use: object shape, required, and per-field type/description.
 * For richer support, swap this for `zod-to-json-schema`.
 */
function zodToJsonSchemaSafe(schema: unknown): Record<string, unknown> {
  try {
    // Lazy require to avoid pulling the dep into stdio bundle if absent.
    // We hand-roll the conversion to keep zero extra deps.
    const obj = schema as { _def?: { typeName?: string }; shape?: Record<string, unknown> };
    if (obj?._def?.typeName === 'ZodObject' && obj.shape) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, field] of Object.entries(obj.shape)) {
        const f = field as { _def?: { typeName?: string; description?: string; defaultValue?: () => unknown }; isOptional?: () => boolean; description?: string };
        const typeName = f._def?.typeName ?? 'ZodAny';
        const jsType = mapZodType(typeName);
        properties[key] = { type: jsType, description: f.description ?? f._def?.description };
        const optional = f.isOptional?.() ?? false;
        const hasDefault = typeof f._def?.defaultValue === 'function';
        if (!optional && !hasDefault) required.push(key);
      }
      return { type: 'object', properties, required, additionalProperties: false };
    }
  } catch {
    /* fall through */
  }
  return { type: 'object' };
}

function mapZodType(name: string): string {
  switch (name) {
    case 'ZodString':
    case 'ZodEnum':
    case 'ZodNativeEnum':
      return 'string';
    case 'ZodNumber':
    case 'ZodBigInt':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
    case 'ZodRecord':
      return 'object';
    default:
      return 'string';
  }
}
