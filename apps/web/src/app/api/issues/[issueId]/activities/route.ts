import { NextRequest, NextResponse } from 'next/server';
import { getIssueActivities } from '@tasknebula/db';
import { auth } from '@/auth';

// GET /api/issues/[issueId]/activities - Get all activities for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;
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

