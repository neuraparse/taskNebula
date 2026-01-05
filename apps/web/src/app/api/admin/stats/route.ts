/**
 * Super Admin API - System Statistics
 * GET /api/admin/stats - Get system-wide statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, organizations, users, projects, issues, issueComments } from '@tasknebula/db';
import { eq, count, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';

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

    // Get total counts
    const [totalOrgs] = await db.select({ count: count() }).from(organizations);
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalProjects] = await db.select({ count: count() }).from(projects);
    const [totalIssues] = await db.select({ count: count() }).from(issues);
    const [totalComments] = await db.select({ count: count() }).from(issueComments);

    // Get organization status breakdown
    const orgsByStatus = await db
      .select({
        status: organizations.status,
        count: count(),
      })
      .from(organizations)
      .groupBy(organizations.status);

    // Get organization plan breakdown
    const orgsByPlan = await db
      .select({
        plan: organizations.plan,
        count: count(),
      })
      .from(organizations)
      .groupBy(organizations.plan);

    // Get active users (users with status 'active')
    const [activeUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.status, 'active'));

    // Get super admin count
    const [superAdminCount] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.isSuperAdmin, true));

    // Get recent organizations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentOrgs] = await db
      .select({ count: count() })
      .from(organizations)
      .where(sql`${organizations.createdAt} >= ${thirtyDaysAgo.toISOString()}`);

    // Get recent users (last 30 days)
    const [recentUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${thirtyDaysAgo.toISOString()}`);

    // Format status breakdown
    const statusBreakdown = {
      active: 0,
      trial: 0,
      suspended: 0,
    };
    orgsByStatus.forEach((item) => {
      statusBreakdown[item.status as keyof typeof statusBreakdown] = Number(item.count);
    });

    // Format plan breakdown
    const planBreakdown = {
      free: 0,
      starter: 0,
      growth: 0,
      enterprise: 0,
    };
    orgsByPlan.forEach((item) => {
      planBreakdown[item.plan as keyof typeof planBreakdown] = Number(item.count);
    });

    return NextResponse.json({
      overview: {
        totalOrganizations: Number(totalOrgs?.count || 0),
        totalUsers: Number(totalUsers?.count || 0),
        activeUsers: Number(activeUsers?.count || 0),
        superAdmins: Number(superAdminCount?.count || 0),
        totalProjects: Number(totalProjects?.count || 0),
        totalIssues: Number(totalIssues?.count || 0),
        totalComments: Number(totalComments?.count || 0),
      },
      organizations: {
        byStatus: statusBreakdown,
        byPlan: planBreakdown,
      },
      growth: {
        newOrganizations30d: Number(recentOrgs?.count || 0),
        newUsers30d: Number(recentUsers?.count || 0),
      },
    });
  } catch (error) {
    console.error('Failed to fetch system stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system stats' },
      { status: 500 }
    );
  }
}

