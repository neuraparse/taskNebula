import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, auditLogs, users } from '@tasknebula/db';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/audit-logs?organizationId=xxx&resourceType=xxx&resourceId=xxx&limit=50
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const projectId = searchParams.get('projectId');
    const issueId = searchParams.get('issueId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Build query conditions
    const conditions = [eq(auditLogs.organizationId, organizationId)];

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }
    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }
    if (projectId) {
      conditions.push(eq(auditLogs.projectId, projectId));
    }
    if (issueId) {
      conditions.push(eq(auditLogs.issueId, issueId));
    }

    // Fetch audit logs with user information
    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        projectId: auditLogs.projectId,
        issueId: auditLogs.issueId,
        changes: auditLogs.changes,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return NextResponse.json({ auditLogs: logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

