/**
 * /api/ai/disclosures — read + write the EU AI Act Article 50 ledger.
 *
 *   GET  ?workspaceId=...   -> { acknowledgedVersions: string[] }
 *   POST { workspaceId, version } -> 204 (idempotent)
 *
 * Each (workspaceId, userId, version) triple is unique. Writes are idempotent
 * via ON CONFLICT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { aiDisclosuresAcknowledged, db, organizationMembers } from '@tasknebula/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

async function assertWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, workspaceId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  return !!row;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  if (!(await assertWorkspaceMember(session.user.id, workspaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db
    .select({ version: aiDisclosuresAcknowledged.version })
    .from(aiDisclosuresAcknowledged)
    .where(
      and(
        eq(aiDisclosuresAcknowledged.workspaceId, workspaceId),
        eq(aiDisclosuresAcknowledged.userId, session.user.id)
      )
    );

  return NextResponse.json({
    acknowledgedVersions: rows.map((r) => r.version),
  });
}

const postSchema = z.object({
  workspaceId: z.string().min(1),
  version: z.string().min(1).max(32),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!(await assertWorkspaceMember(session.user.id, body.workspaceId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Idempotent insert — duplicate triple is a no-op.
  await db
    .insert(aiDisclosuresAcknowledged)
    .values({
      workspaceId: body.workspaceId,
      userId: session.user.id,
      version: body.version,
    })
    .onConflictDoNothing({
      target: [
        aiDisclosuresAcknowledged.workspaceId,
        aiDisclosuresAcknowledged.userId,
        aiDisclosuresAcknowledged.version,
      ],
    });

  return new NextResponse(null, { status: 204 });
}
