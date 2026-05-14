/**
 * Remote MCP endpoint for TaskNebula.
 *
 * This route mounts the HTTP/JSON-RPC handler exported by
 * `@tasknebula/mcp-server`. Tool definitions are imported as-is so the
 * remote endpoint and the local stdio binary always stay in lockstep.
 *
 * Auth: OAuth 2.1 Bearer token in `Authorization`. Until the OAuth
 * provider routes land you can also pass a TaskNebula API key in the
 * same header for testing.
 */
import { createMcpHttpHandler } from '@tasknebula/mcp-server/http';

// Node runtime — the MCP handler uses Node's `fetch` to talk to the
// internal REST API, and edge runtime doesn't help us here.
export const runtime = 'nodejs';

// Avoid Next caching for what is effectively a JSON-RPC endpoint.
export const dynamic = 'force-dynamic';

const handler = createMcpHttpHandler();

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
