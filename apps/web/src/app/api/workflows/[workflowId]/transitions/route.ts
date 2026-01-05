import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, workflowTransitions, workflowStatuses } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

// GET /api/workflows/[workflowId]/transitions - Get all transitions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = await params;

    const transitions = await db
      .select()
      .from(workflowTransitions)
      .where(eq(workflowTransitions.workflowId, workflowId));

    return NextResponse.json(transitions);
  } catch (error) {
    console.error('Error fetching transitions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workflows/[workflowId]/transitions - Create a transition
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflowId } = await params;
    const body = await request.json();
    const { name, fromStatusId, toStatusId, conditions, validators, postActions } = body;

    if (!name || !fromStatusId || !toStatusId) {
      return NextResponse.json(
        { error: 'Name, fromStatusId, and toStatusId are required' },
        { status: 400 }
      );
    }

    const [transition] = await db
      .insert(workflowTransitions)
      .values({
        workflowId,
        name,
        fromStatusId,
        toStatusId,
        conditions: conditions || [],
        validators: validators || [],
        postActions: postActions || [],
      })
      .returning();

    return NextResponse.json(transition, { status: 201 });
  } catch (error) {
    console.error('Error creating transition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
