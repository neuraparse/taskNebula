import { NextResponse } from 'next/server';
import { agentSessions, db, desc, eq, getIssueById } from '@tasknebula/db';
import { auth } from '@/auth';
import { resolveProjectAccess } from '@/lib/auth/project-access';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;
  const issue = await getIssueById(issueId);
  if (!issue) {
    return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
  }

  const access = await resolveProjectAccess(session.user.id, issue.projectId);
  if (!access.canRead) {
    return NextResponse.json({ error: 'No permission to view this issue' }, { status: 403 });
  }

  const sessions = await db
    .select({
      id: agentSessions.id,
      issueId: agentSessions.issueId,
      provider: agentSessions.provider,
      externalId: agentSessions.externalId,
      state: agentSessions.state,
      payload: agentSessions.payload,
      startedAt: agentSessions.startedAt,
      updatedAt: agentSessions.updatedAt,
      finishedAt: agentSessions.finishedAt,
    })
    .from(agentSessions)
    .where(eq(agentSessions.issueId, issueId))
    .orderBy(desc(agentSessions.startedAt))
    .limit(20);

  return NextResponse.json({ sessions });
}
