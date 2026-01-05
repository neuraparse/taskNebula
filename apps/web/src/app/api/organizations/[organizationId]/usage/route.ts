import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrganizationLimitsAndUsage } from '@/lib/plan-limits-checker';
import { hasPermission } from '@/lib/auth/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Check if user has permission to view organization
    const canView = await hasPermission(organizationId, 'org:read');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get usage and limits
    const data = await getOrganizationLimitsAndUsage(organizationId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching organization usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization usage' },
      { status: 500 }
    );
  }
}

