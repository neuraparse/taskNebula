import { NextRequest, NextResponse } from 'next/server';
import { addAgentExecuteJob } from '@/lib/queue/agent-queue';
import { auth } from '@/auth';
import { db, agentWorkspaces, agentSessions, issues } from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { issueId, executorProfile, executorVariant, initialPrompt } = body;

    if (!issueId || !executorProfile) {
      return NextResponse.json(
        { error: 'Missing required fields: issueId, executorProfile' },
        { status: 400 }
      );
    }

    // Validate issue exists
    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: { project: true },
    });

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    // TODO: Check user has permission to execute agents on this issue/project

    // Create workspace in database
    const workspaceId = createId();
    const branchName = `agent/${issue.key || issueId}`;

    await db.insert(agentWorkspaces).values({
      id: workspaceId,
      issueId: issue.id,
      projectId: issue.projectId,
      branchName,
      status: 'setup_pending',
    });

    // Create session in database
    const sessionId = createId();

    await db.insert(agentSessions).values({
      id: sessionId,
      workspaceId,
      executorProfile,
      executorVariant: executorVariant || 'DEFAULT',
      environmentVariables: {},
      mcpConfig: {},
    });

    // Add job to queue
    const job = await addAgentExecuteJob({
      sessionId,
      workspaceId,
      issueId,
      executorProfile,
      executorVariant,
      initialPrompt,
    });

    return NextResponse.json({
      executionId: job.id,
      workspaceId,
      sessionId,
      status: 'queued',
      message: 'Agent execution started',
    });
  } catch (error) {
    console.error('[API] Agent execute failed:', error);
    return NextResponse.json(
      { error: 'Failed to start agent execution' },
      { status: 500 }
    );
  }
}
