import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, systemAuditLogs, users } from '@tasknebula/db';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const search = searchParams.get('search');
    const resourceType = searchParams.get('resourceType');

    const conditions = [];

    if (resourceType && resourceType !== 'all') {
      conditions.push(eq(systemAuditLogs.resourceType, resourceType));
    }

    if (search) {
      conditions.push(
        or(
          ilike(systemAuditLogs.action, `%${search}%`),
          ilike(systemAuditLogs.resourceType, `%${search}%`),
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          sql`${systemAuditLogs.metadata}::text ILIKE ${`%${search}%`}`,
          sql`${systemAuditLogs.changes}::text ILIKE ${`%${search}%`}`
        )!
      );
    }

    const query = db
      .select({
        id: systemAuditLogs.id,
        action: systemAuditLogs.action,
        resourceType: systemAuditLogs.resourceType,
        resourceId: systemAuditLogs.resourceId,
        organizationId: systemAuditLogs.organizationId,
        changes: systemAuditLogs.changes,
        metadata: systemAuditLogs.metadata,
        ipAddress: systemAuditLogs.ipAddress,
        userAgent: systemAuditLogs.userAgent,
        createdAt: systemAuditLogs.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(systemAuditLogs)
      .leftJoin(users, eq(systemAuditLogs.userId, users.id))
      .orderBy(desc(systemAuditLogs.createdAt))
      .limit(limit);

    const logs = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

    return NextResponse.json({ auditLogs: logs });
  } catch (error) {
    console.error('Failed to fetch admin audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin audit logs' },
      { status: 500 }
    );
  }
}
