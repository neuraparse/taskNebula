import { NextRequest, NextResponse } from 'next/server';
import { db, projects, workflows, workflowStatuses, workflowTransitions } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and } from 'drizzle-orm';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

async function resolveWorkflowId(project: { id: string; organizationId: string; defaultWorkflowId: string | null }) {
  if (project.defaultWorkflowId) return project.defaultWorkflowId;
  const [defaultWorkflow] = await db
    .select()
    .from(workflows)
    .where(
      and(eq(workflows.organizationId, project.organizationId), eq(workflows.isDefault, true))
    )
    .limit(1);
  return defaultWorkflow?.id ?? null;
}

// GET /api/projects/[projectId]/workflow-transitions
// Returns the transition rules for the project's workflow.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const workflowId = await resolveWorkflowId(project);
    if (!workflowId) {
      return NextResponse.json({ transitions: [], statuses: [] });
    }

    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId));

    const transitions = await db
      .select()
      .from(workflowTransitions)
      .where(eq(workflowTransitions.workflowId, workflowId));

    return NextResponse.json({ statuses, transitions });
  } catch (error) {
    console.error('Failed to load workflow transitions', error);
    return NextResponse.json({ error: 'Failed to load workflow transitions' }, { status: 500 });
  }
}

// PUT /api/projects/[projectId]/workflow-transitions
// Body: { transitions: Array<{ fromStatusId: string; toStatusId: string; name?: string; conditions?: any; validators?: any; postActions?: any }> }
// Replaces all transitions for the workflow atomically.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const workflowId = await resolveWorkflowId(project);
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow not configured for this project' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const rawTransitions = Array.isArray(body?.transitions) ? body.transitions : null;
    if (!rawTransitions) {
      return NextResponse.json({ error: 'transitions array is required' }, { status: 400 });
    }

    const workflowStatusRows = await db
      .select({ id: workflowStatuses.id })
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId));
    const validStatusIds = new Set(workflowStatusRows.map((s) => s.id));

    const normalized = rawTransitions.map((raw: any) => {
      if (!raw?.fromStatusId || !raw?.toStatusId) {
        throw new Error('transition missing fromStatusId or toStatusId');
      }
      if (!validStatusIds.has(raw.fromStatusId) || !validStatusIds.has(raw.toStatusId)) {
        throw new Error('transition references an unknown status for this workflow');
      }
      return {
        workflowId,
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `Transition ${raw.fromStatusId} → ${raw.toStatusId}`,
        fromStatusId: raw.fromStatusId as string,
        toStatusId: raw.toStatusId as string,
        conditions: raw.conditions ?? [],
        validators: raw.validators ?? [],
        postActions: raw.postActions ?? [],
      };
    });

    // Replace all transitions for this workflow in a single pass.
    await db.transaction(async (tx) => {
      await tx.delete(workflowTransitions).where(eq(workflowTransitions.workflowId, workflowId));
      if (normalized.length > 0) {
        await tx.insert(workflowTransitions).values(normalized);
      }
    });

    const saved = await db
      .select()
      .from(workflowTransitions)
      .where(eq(workflowTransitions.workflowId, workflowId));

    return NextResponse.json({ transitions: saved });
  } catch (error) {
    console.error('Failed to save workflow transitions', error);
    const message = error instanceof Error ? error.message : 'Failed to save workflow transitions';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
