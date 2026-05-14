/**
 * SCIM 2.0 single-Group endpoints.
 *   GET    /Groups/{id}   → Read
 *   PUT    /Groups/{id}   → Replace (Okta)
 *   PATCH  /Groups/{id}   → Modify  (Entra)
 *   DELETE /Groups/{id}   → Delete
 */
import { NextRequest } from 'next/server';
import { authenticateScimRequest } from '@/lib/sso/tokens';
import { scimError, scimResponse } from '@/lib/scim/types';
import type { PatchRequest } from '@/lib/scim/types';
import {
  applyGroupMembershipChanges,
  deleteWorkspaceGroup,
  getWorkspaceGroup,
  renameWorkspaceGroup,
  toScimGroup,
} from '@/lib/scim/groups';
import { applyGroupPatch } from '@/lib/scim/patch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ctx(request: NextRequest, id: string) {
  const auth = await authenticateScimRequest(
    request.headers.get('authorization')
  );
  if (!auth) return { error: scimError(401, 'Invalid or missing SCIM token') };
  const row = await getWorkspaceGroup(auth.workspaceId, id);
  if (!row) return { error: scimError(404, `Group ${id} not found`) };
  return { auth, row };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = await ctx(request, id);
  if ('error' in c) return c.error;
  return scimResponse(toScimGroup(c.row));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = await ctx(request, id);
  if ('error' in c) return c.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return scimError(400, 'Body must be JSON', 'invalidSyntax');
  }
  if (typeof body.displayName === 'string') {
    await renameWorkspaceGroup(c.auth.workspaceId, id, body.displayName);
  }
  const memberIds = Array.isArray(body.members)
    ? (body.members as { value: string }[]).map((m) => m.value)
    : [];
  await applyGroupMembershipChanges(c.auth.workspaceId, id, {
    replace: memberIds,
  });

  const updated = await getWorkspaceGroup(c.auth.workspaceId, id);
  if (!updated) return scimError(500, 'Group updated but could not be re-read');
  return scimResponse(toScimGroup(updated));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = await ctx(request, id);
  if ('error' in c) return c.error;

  let body: PatchRequest;
  try {
    body = (await request.json()) as PatchRequest;
  } catch {
    return scimError(400, 'Body must be JSON', 'invalidSyntax');
  }
  if (!Array.isArray(body.Operations)) {
    return scimError(400, 'PATCH body missing Operations', 'invalidSyntax');
  }

  let patch;
  try {
    patch = applyGroupPatch(body.Operations);
  } catch (err) {
    return scimError(400, (err as Error).message, 'invalidSyntax');
  }
  if (patch.displayName !== undefined) {
    await renameWorkspaceGroup(c.auth.workspaceId, id, patch.displayName);
  }
  await applyGroupMembershipChanges(c.auth.workspaceId, id, {
    add: patch.addMembers,
    remove: patch.removeMembers,
    replace: patch.replaceMembers,
  });

  const updated = await getWorkspaceGroup(c.auth.workspaceId, id);
  if (!updated) return scimError(500, 'Group updated but could not be re-read');
  return scimResponse(toScimGroup(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = await ctx(request, id);
  if ('error' in c) return c.error;
  await deleteWorkspaceGroup(c.auth.workspaceId, id);
  return new Response(null, { status: 204 });
}
