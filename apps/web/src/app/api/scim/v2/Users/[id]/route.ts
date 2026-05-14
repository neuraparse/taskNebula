/**
 * SCIM 2.0 single-User endpoints.
 *
 *   GET    /Users/{id}        → Read user
 *   PUT    /Users/{id}        → Replace (Okta uses this)
 *   PATCH  /Users/{id}        → Modify (Entra ID uses this)
 *   DELETE /Users/{id}        → De-provision
 */
import { NextRequest } from 'next/server';
import { authenticateScimRequest } from '@/lib/sso/tokens';
import { scimError, scimResponse } from '@/lib/scim/types';
import {
  getWorkspaceUser,
  toScimUser,
  setMembershipStatus,
  updateUserCore,
} from '@/lib/scim/users';
import { applyUserPatch } from '@/lib/scim/patch';
import type { PatchRequest } from '@/lib/scim/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authedUser(request: NextRequest, id: string) {
  const auth = await authenticateScimRequest(
    request.headers.get('authorization')
  );
  if (!auth) return { error: scimError(401, 'Invalid or missing SCIM token') };
  const row = await getWorkspaceUser(auth.workspaceId, id);
  if (!row) return { error: scimError(404, `User ${id} not found`) };
  return { auth, row };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authedUser(request, id);
  if ('error' in ctx) return ctx.error;
  return scimResponse(toScimUser(ctx.row));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authedUser(request, id);
  if ('error' in ctx) return ctx.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return scimError(400, 'Body must be JSON', 'invalidSyntax');
  }

  const userName =
    typeof body.userName === 'string' ? body.userName : ctx.row.email;
  const name = (body.name ?? {}) as { givenName?: string; familyName?: string };
  const formatted = [name.givenName, name.familyName]
    .filter((x): x is string => !!x && x.length > 0)
    .join(' ') || ctx.row.name;
  const active = typeof body.active === 'boolean' ? body.active : true;

  await updateUserCore(id, {
    email: userName,
    name: formatted ?? null,
  });
  await setMembershipStatus(
    ctx.auth.workspaceId,
    id,
    active ? 'active' : 'inactive'
  );

  const updated = await getWorkspaceUser(ctx.auth.workspaceId, id);
  if (!updated) return scimError(500, 'User updated but could not be re-read');
  return scimResponse(toScimUser(updated));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authedUser(request, id);
  if ('error' in ctx) return ctx.error;

  let body: PatchRequest;
  try {
    body = (await request.json()) as PatchRequest;
  } catch {
    return scimError(400, 'Body must be JSON', 'invalidSyntax');
  }
  if (!Array.isArray(body.Operations)) {
    return scimError(400, 'PATCH body missing Operations', 'invalidSyntax');
  }

  const [givenName, ...rest] = (ctx.row.name ?? '').split(' ');
  let patch;
  try {
    patch = applyUserPatch(body.Operations, {
      userName: ctx.row.email,
      name: { givenName, familyName: rest.join(' ') },
      displayName: ctx.row.name,
      active: ctx.row.membership.status === 'active',
    });
  } catch (err) {
    return scimError(400, (err as Error).message, 'invalidSyntax');
  }

  // Re-assemble name from given / family if either changed.
  const nextGiven = patch.givenName ?? givenName ?? null;
  const nextFamily = patch.familyName ?? rest.join(' ') ?? null;
  const recombined = [nextGiven, nextFamily]
    .filter((x): x is string => !!x && x.length > 0)
    .join(' ');
  const nextName = patch.displayName ?? recombined ?? null;

  await updateUserCore(id, {
    email: patch.userName ?? patch.primaryEmail,
    name: nextName,
  });
  if (typeof patch.active === 'boolean') {
    await setMembershipStatus(
      ctx.auth.workspaceId,
      id,
      patch.active ? 'active' : 'inactive'
    );
  }

  const updated = await getWorkspaceUser(ctx.auth.workspaceId, id);
  if (!updated) return scimError(500, 'User updated but could not be re-read');
  return scimResponse(toScimUser(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await authedUser(request, id);
  if ('error' in ctx) return ctx.error;
  // Soft-de-provision: flip membership to inactive instead of deleting the
  // global user row (the same person may belong to multiple workspaces).
  await setMembershipStatus(ctx.auth.workspaceId, id, 'inactive');
  return new Response(null, { status: 204 });
}
