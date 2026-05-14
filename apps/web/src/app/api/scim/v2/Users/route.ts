/**
 * SCIM 2.0 Users collection — list (filtered) + create.
 *
 * RFC 7644 §3.4 (Querying Resources) + §3.3 (Creating Resources).
 *
 * Auth is `Authorization: Bearer <scim_token>`; the token belongs to a
 * workspace, so all queries are implicitly scoped to that workspace.
 */
import { NextRequest } from 'next/server';
import { jitProvisionUser } from '@/lib/sso/jit';
import { authenticateScimRequest } from '@/lib/sso/tokens';
import { scimError, scimResponse, SCIM_SCHEMAS } from '@/lib/scim/types';
import {
  listWorkspaceUsers,
  parseUserFilter,
  toScimUser,
} from '@/lib/scim/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await authenticateScimRequest(
    request.headers.get('authorization')
  );
  if (!auth) return scimError(401, 'Invalid or missing SCIM token');

  const url = new URL(request.url);
  const startIndex = parseInt(url.searchParams.get('startIndex') ?? '1', 10);
  const count = parseInt(url.searchParams.get('count') ?? '100', 10);
  const filter = parseUserFilter(url.searchParams.get('filter'));

  const { rows, total } = await listWorkspaceUsers(auth.workspaceId, {
    startIndex,
    count,
    userName: filter.userName,
  });

  return scimResponse({
    schemas: [SCIM_SCHEMAS.listResponse],
    totalResults: total,
    startIndex,
    itemsPerPage: rows.length,
    Resources: rows.map(toScimUser),
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateScimRequest(
    request.headers.get('authorization')
  );
  if (!auth) return scimError(401, 'Invalid or missing SCIM token');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return scimError(400, 'Body must be JSON', 'invalidSyntax');
  }

  const userName = typeof body.userName === 'string' ? body.userName : '';
  if (!userName) return scimError(400, 'userName is required', 'invalidValue');

  const name = (body.name ?? {}) as { givenName?: string; familyName?: string };
  const emails = Array.isArray(body.emails)
    ? (body.emails as { value: string; primary?: boolean }[])
    : [];
  const email =
    emails.find((e) => e.primary)?.value ?? emails[0]?.value ?? userName;

  if (!email || !email.includes('@')) {
    return scimError(400, 'A valid primary email is required', 'invalidValue');
  }

  const result = await jitProvisionUser({
    email,
    firstName: name.givenName ?? null,
    lastName: name.familyName ?? null,
    workspaceId: auth.workspaceId,
    groups: [],
  });

  // Re-read so we return canonical state.
  const { getWorkspaceUser, toScimUser: shape } = await import(
    '@/lib/scim/users'
  );
  const row = await getWorkspaceUser(auth.workspaceId, result.userId);
  if (!row) return scimError(500, 'User created but could not be re-read');

  return scimResponse(shape(row), 201);
}
