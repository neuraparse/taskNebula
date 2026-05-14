/**
 * Remote MCP endpoint for TaskNebula (stub).
 *
 * The full HTTP transport lives in `@tasknebula/mcp-server` and is consumed
 * directly via `npx @tasknebula/mcp-server` (stdio). The remote variant is
 * deferred until the OAuth 2.1 + PKCE provider lands; for now this route
 * returns a 503 with a hint so clients fail loudly instead of silently
 * mis-configuring themselves.
 *
 * Tracked: docs/ROADMAP_2026.md (P0-05) follow-ups.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function response() {
  return new Response(
    JSON.stringify({
      error: 'mcp_http_not_yet_available',
      message:
        'The remote MCP HTTP transport is not yet enabled on this deployment. ' +
        'Run `npx -y @tasknebula/mcp-server` locally with TASKNEBULA_API_URL ' +
        'and TASKNEBULA_API_KEY for stdio access today.',
    }),
    {
      status: 503,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    },
  );
}

export async function GET() {
  return response();
}

export async function POST() {
  return response();
}
