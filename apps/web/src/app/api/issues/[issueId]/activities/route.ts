import { NextRequest, NextResponse } from 'next/server';
import { getIssueActivities } from '@tasknebula/db';
import { auth } from '@/auth';
import { canReadIssue, isActiveOrganizationMember } from '@/lib/auth/access-control';

// GET /api/issues/[issueId]/activities - Get all activities for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Permission check: caller must be able to read the issue. Cross-org
    // probes get a 404 so we don't leak that the issue exists.
    const access = await canReadIssue(session.user.id, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      const sameOrg = await isActiveOrganizationMember(
        session.user.id,
        access.issue.organizationId
      );
      return NextResponse.json(
        { error: sameOrg ? 'Forbidden' : 'Issue not found' },
        { status: sameOrg ? 403 : 404 }
      );
    }

    const activities = await getIssueActivities(issueId);

    return NextResponse.json({
      activities,
      total: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}
