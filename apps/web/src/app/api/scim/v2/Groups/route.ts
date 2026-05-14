/**
 * SCIM 2.0 Groups collection — list + create.
 */
import { NextRequest } from 'next/server';
import { authenticateScimRequest } from '@/lib/sso/tokens';
import { scimError, scimResponse, SCIM_SCHEMAS } from '@/lib/scim/types';
import {
  createWorkspaceGroup,
  listWorkspaceGroups,
  toScimGroup,
} from '@/lib/scim/groups';

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

  const { rows, total } = await listWorkspaceGroups(auth.workspaceId, {
    startIndex,
    count,
  });

  return scimResponse({
    schemas: [SCIM_SCHEMAS.listResponse],
    totalResults: total,
    startIndex,
    itemsPerPage: rows.length,
    Resources: rows.map(toScimGroup),
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
  const displayName =
    typeof body.displayName === 'string' ? body.displayName : '';
  if (!displayName) {
    return scimError(400, 'displayName is required', 'invalidValue');
  }
  const memberIds = Array.isArray(body.members)
    ? (body.members as { value: string }[]).map((m) => m.value)
    : [];
  const created = await createWorkspaceGroup(
    auth.workspaceId,
    displayName,
    memberIds
  );
  return scimResponse(toScimGroup(created), 201);
}
