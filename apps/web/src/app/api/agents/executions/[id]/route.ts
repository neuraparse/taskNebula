import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/queue/agent-queue';
import { auth } from '@/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobStatus = await getJobStatus(params.id);

    if (!jobStatus) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: jobStatus.id,
      status: jobStatus.progress,
      data: jobStatus.data,
      returnvalue: jobStatus.returnvalue,
      failedReason: jobStatus.failedReason,
      timestamp: jobStatus.timestamp,
      finishedOn: jobStatus.finishedOn,
      processedOn: jobStatus.processedOn,
    });
  } catch (error) {
    console.error('[API] Get execution failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution status' },
      { status: 500 }
    );
  }
}
