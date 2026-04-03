import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflowTransitions } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workflowId: string; transitionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId, transitionId } = await params;

    const [deletedTransition] = await db
      .delete(workflowTransitions)
      .where(and(eq(workflowTransitions.id, transitionId), eq(workflowTransitions.workflowId, workflowId)))
      .returning();

    if (!deletedTransition) {
      return NextResponse.json({ error: 'Transition not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow transition:', error);
    return NextResponse.json({ error: 'Failed to delete workflow transition' }, { status: 500 });
  }
}
