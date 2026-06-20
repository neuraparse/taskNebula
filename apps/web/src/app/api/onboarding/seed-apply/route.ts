/**
 * POST /api/onboarding/seed-apply
 *
 * Body: { seed: WorkspaceSeed, organizationId?: string }
 *
 * Applies the (possibly user-edited) workspace seed transactionally:
 *   - ensures/creates a default workflow + statuses
 *   - creates teams (with unique slugs)
 *   - creates the project (with unique key)
 *   - creates cycles (sprints) and issues
 *
 * Everything happens inside a single db.transaction so any failure rolls
 * back the entire seed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, organizationMembers } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { workspaceSeedSchema } from '@/lib/onboarding/bootstrapper';
import { applyWorkspaceSeed, ApplySeedError } from '@/lib/onboarding/apply-seed';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodyObj = (body && typeof body === 'object' ? body : {}) as {
    seed?: unknown;
    organizationId?: unknown;
  };
  const parsed = workspaceSeedSchema.safeParse(bodyObj.seed);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Seed failed validation',
        details: parsed.error.errors.slice(0, 5).map((e) => `${e.path.join('.')} ${e.message}`),
      },
      { status: 400 }
    );
  }

  // Resolve organizationId — explicit body override or the user's first org.
  let organizationId = typeof bodyObj.organizationId === 'string' ? bodyObj.organizationId : null;
  if (!organizationId) {
    const [membership] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
      .limit(1);
    if (!membership) {
      return NextResponse.json(
        { error: 'No organization found for the current user.' },
        { status: 400 }
      );
    }
    organizationId = membership.organizationId;
  }

  try {
    const result = await applyWorkspaceSeed({
      seed: parsed.data,
      organizationId,
      userId,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    if (err instanceof ApplySeedError) {
      const status =
        err.code === 'forbidden'
          ? 403
          : err.code === 'not_found'
            ? 404
            : err.code === 'invalid_input' || err.code === 'schema_violation'
              ? 400
              : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('seed-apply error', err);
    return NextResponse.json(
      { error: 'Failed to apply workspace seed. The transaction has rolled back.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
