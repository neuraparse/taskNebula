import { NextRequest, NextResponse } from 'next/server';
import { agentQueue } from '@/lib/queue/agent-queue';
import { auth } from '@/auth';
import { db, agentExecutionProcesses } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await agentQueue.getJob(params.id);

    if (!job) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Remove job from queue
    await job.remove();

    // Update execution status in database
    await db
      .update(agentExecutionProcesses)
      .set({
        status: 'cancelled',
        dropped: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentExecutionProcesses.id, params.id));

    // TODO: Stop Docker container if running (handled by worker on job removal)

    return NextResponse.json({
      id: params.id,
      status: 'cancelled',
      message: 'Agent execution stopped',
    });
  } catch (error) {
    console.error('[API] Stop execution failed:', error);
    return NextResponse.json(
      { error: 'Failed to stop execution' },
      { status: 500 }
    );
  }
}
