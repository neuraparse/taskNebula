import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';
import { discoverAgentPolicy } from '@/lib/agent-policy/source';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_required' }, { status: 400 });
  }

  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const policy = await discoverAgentPolicy();
  return NextResponse.json({
    enabled: policy.found && policy.errors.length === 0,
    found: policy.found,
    sourcePath: policy.sourcePath,
    parsedAt: policy.parsedAt,
    errors: policy.errors,
    rules: policy.rules,
  });
}
