/**
 * Authentication helpers for the TaskNebula MCP server.
 *
 * The MCP spec (2025-03-26) recommends OAuth 2.1 with PKCE for remote
 * (HTTP/Streamable) servers and lets stdio servers rely on out-of-band
 * credentials (env vars). This file ships both code paths:
 *
 *   - `resolveStdioAuth`: pulls the API key from env for local Cursor /
 *     Claude Desktop / Claude Code usage.
 *
 *   - `resolveHttpAuth`: extracts a Bearer token from an incoming HTTP
 *     request, validates it against the TaskNebula API (or, eventually,
 *     against our OAuth 2.1 provider — see TODO below).
 *
 * NOTE (P0-05 follow-up): the OAuth 2.1 + PKCE flow itself (authorize +
 * token endpoints, dynamic client registration per RFC 7591, refresh
 * tokens, scope management) is intentionally a stub. The hooks below
 * give a place to plug in the real implementation in P1-XX without
 * having to refactor the transport or the tool registry.
 */

import type { TaskNebulaClientOptions } from './client.js';

export interface StdioAuthContext {
  apiUrl: string;
  apiKey?: string;
}

export interface HttpAuthContext {
  apiUrl: string;
  accessToken?: string;
  /** Subject (user id) extracted from the OAuth token. */
  subject?: string;
  /** Granted scopes — checked by tools that mutate data. */
  scopes?: string[];
}

export function resolveStdioAuth(env: NodeJS.ProcessEnv = process.env): StdioAuthContext {
  const apiUrl = env.TASKNEBULA_API_URL ?? 'http://localhost:3000';
  const apiKey = env.TASKNEBULA_API_KEY;
  if (!apiKey) {
    // We don't throw — tools will surface a clear error on first call.
    // This keeps `npx @tasknebula/mcp-server` usable for `tools/list`
    // even before the user pastes their key.
    // eslint-disable-next-line no-console
    console.error(
      '[tasknebula-mcp] WARNING: TASKNEBULA_API_KEY is not set. ' +
        'Tools that hit the API will fail until you set it.',
    );
  }
  return { apiUrl, apiKey };
}

/**
 * Extract a Bearer token from the `Authorization` header.
 *
 * TODO(P1): replace this with full OAuth 2.1 verification:
 *   1. Discover provider via `.well-known/oauth-protected-resource`.
 *   2. Verify JWT signature against the provider's JWKS (cache JWKS).
 *   3. Enforce `aud`, `iss`, `exp`, and required scopes (e.g.
 *      `issues:read`, `issues:write`, `comments:write`).
 *   4. Support refresh tokens & dynamic client registration (RFC 7591).
 */
export function resolveHttpAuth(
  request: { headers: Headers | Record<string, string | string[] | undefined> },
  env: NodeJS.ProcessEnv = process.env,
): HttpAuthContext {
  const apiUrl = env.TASKNEBULA_API_URL ?? 'http://localhost:3000';
  const headerValue = getHeader(request.headers, 'authorization');
  if (!headerValue) {
    return { apiUrl };
  }
  const match = /^Bearer\s+(.+)$/i.exec(headerValue);
  if (!match) {
    return { apiUrl };
  }
  const token = match[1]!.trim();
  // For now we forward the token verbatim to the REST API which already
  // accepts session bearer tokens and API keys. A real OAuth provider
  // would do JWT verification here.
  return {
    apiUrl,
    accessToken: token,
    // Optimistic; the API will reject if the token is bad.
    scopes: ['issues:read', 'issues:write', 'comments:write'],
  };
}

export function clientOptionsFromStdio(ctx: StdioAuthContext): TaskNebulaClientOptions {
  return { apiUrl: ctx.apiUrl, apiKey: ctx.apiKey };
}

export function clientOptionsFromHttp(ctx: HttpAuthContext): TaskNebulaClientOptions {
  return { apiUrl: ctx.apiUrl, accessToken: ctx.accessToken };
}

function getHeader(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  const rec = headers as Record<string, string | string[] | undefined>;
  const v = rec[name] ?? rec[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}
