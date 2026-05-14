/**
 * SCIM token management — list + create.
 *
 *   GET    ?organizationId=xxx          → list non-secret token metadata
 *   POST   { organizationId, name }     → create a token, return the plaintext
 *                                         ONCE; subsequent reads only see the hash.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, scimTokens, eq, desc, isNull } from '@tasknebula/db';
import { hasPermission } from '@/lib/auth/permissions';
import { generateScimToken, hashScimToken } from '@/lib/sso/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orgId = new URL(request.url).searchParams.get('organizationId');
  if (!orgId) {
    return NextResponse.json(
      { error: 'organizationId is required' },
      { status: 400 }
    );
  }
  if (!(await hasPermission(orgId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const rows = await db
    .select({
      id: scimTokens.id,
      name: scimTokens.name,
      createdAt: scimTokens.createdAt,
      lastUsedAt: scimTokens.lastUsedAt,
      revokedAt: scimTokens.revokedAt,
    })
    .from(scimTokens)
    .where(eq(scimTokens.workspaceId, orgId))
    .orderBy(desc(scimTokens.createdAt));
  return NextResponse.json({ tokens: rows });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (!(await hasPermission(parsed.data.organizationId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { token } = generateScimToken();
  const tokenHash = await hashScimToken(token);
  const inserted = await db
    .insert(scimTokens)
    .values({
      workspaceId: parsed.data.organizationId,
      name: parsed.data.name,
      tokenHash,
    })
    .returning({
      id: scimTokens.id,
      name: scimTokens.name,
      createdAt: scimTokens.createdAt,
    });
  const row = inserted[0];
  if (!row) {
    return NextResponse.json(
      { error: 'Failed to persist SCIM token' },
      { status: 500 }
    );
  }
  return NextResponse.json(
    {
      token, // shown only once
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
    },
    { status: 201 }
  );
}

// Mark referenced symbols used so unused-import linting stays quiet on this
// barrel — `isNull` is reserved for future "only list active tokens" filter.
void isNull;
