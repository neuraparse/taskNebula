import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, intakeForms, intakeSubmissions, organizationMembers } from '@tasknebula/db';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/intake-forms/[id]/submissions — list submissions for an
 * intake form, newest first. Restricted to org members. We hide the
 * `ipHash` field from clients; it exists only for server-side rate
 * limiting / abuse review.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const [form] = await db
      .select()
      .from(intakeForms)
      .where(eq(intakeForms.id, id))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const [member] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, form.workspaceId),
        ),
      )
      .limit(1);
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200);

    const rows = await db
      .select({
        id: intakeSubmissions.id,
        intakeFormId: intakeSubmissions.intakeFormId,
        submittedByEmail: intakeSubmissions.submittedByEmail,
        submittedPayload: intakeSubmissions.submittedPayload,
        status: intakeSubmissions.status,
        createdIssueId: intakeSubmissions.createdIssueId,
        userAgent: intakeSubmissions.userAgent,
        createdAt: intakeSubmissions.createdAt,
      })
      .from(intakeSubmissions)
      .where(eq(intakeSubmissions.intakeFormId, id))
      .orderBy(desc(intakeSubmissions.createdAt))
      .limit(limit);

    return NextResponse.json({ submissions: rows, total: rows.length });
  } catch (error) {
    console.error('List submissions error:', error);
    return NextResponse.json({ error: 'Failed to list submissions' }, { status: 500 });
  }
}
