import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, createAuditLog } from '@tasknebula/db';
import { eq, inArray, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bulkUpdateSchema = z.object({
  issueIds: z.array(z.string()).min(1),
  updates: z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    labels: z.string().optional(),
    sprintId: z.string().optional(),
  }),
});

const bulkDeleteSchema = z.object({
  issueIds: z.array(z.string()).min(1),
});

/**
 * POST /api/issues/bulk
 * 
 * Bulk update issues
 * 
 * Body:
 * {
 *   "action": "update" | "delete",
 *   "issueIds": ["id1", "id2", ...],
 *   "updates": { "status": "done", "priority": "high", ... } // for update action
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    if (!action || !['update', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "update" or "delete"' },
        { status: 400 }
      );
    }

    if (action === 'update') {
      return await handleBulkUpdate(body, session.user.id);
    } else if (action === 'delete') {
      return await handleBulkDelete(body, session.user.id);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}

/**
 * Handle bulk update
 */
async function handleBulkUpdate(body: any, userId: string) {
  const validatedData = bulkUpdateSchema.parse(body);
  const { issueIds, updates } = validatedData;

  // Verify all issues exist and get their current state
  const existingIssues = await db
    .select()
    .from(issues)
    .where(inArray(issues.id, issueIds));

  if (existingIssues.length !== issueIds.length) {
    return NextResponse.json(
      { error: 'Some issues not found' },
      { status: 404 }
    );
  }

  // Perform bulk update
  const updateData: any = {
    ...updates,
    updatedAt: new Date(),
  };

  const updatedIssues = await db
    .update(issues)
    .set(updateData)
    .where(inArray(issues.id, issueIds))
    .returning();

  // Create audit logs for each updated issue
  for (const issue of updatedIssues) {
    const oldIssue = existingIssues.find(i => i.id === issue.id);
    if (oldIssue) {
      try {
        // Build changes object
        const changes: Record<string, { from: any; to: any }> = {};
        for (const key of Object.keys(updates)) {
          const oldValue = (oldIssue as any)[key];
          const newValue = (issue as any)[key];
          if (oldValue !== newValue) {
            changes[key] = {
              from: oldValue,
              to: newValue,
            };
          }
        }

        await createAuditLog({
          action: 'issue.updated',
          userId,
          organizationId: issue.organizationId,
          resourceType: 'issue',
          resourceId: issue.id,
          changes,
          metadata: { bulkOperation: true },
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }
    }
  }

  return NextResponse.json({
    success: true,
    updatedCount: updatedIssues.length,
    issues: updatedIssues,
  });
}

/**
 * Handle bulk delete
 */
async function handleBulkDelete(body: any, userId: string) {
  const validatedData = bulkDeleteSchema.parse(body);
  const { issueIds } = validatedData;

  // Verify all issues exist
  const existingIssues = await db
    .select()
    .from(issues)
    .where(inArray(issues.id, issueIds));

  if (existingIssues.length !== issueIds.length) {
    return NextResponse.json(
      { error: 'Some issues not found' },
      { status: 404 }
    );
  }

  // Delete issues
  await db.delete(issues).where(inArray(issues.id, issueIds));

  // Create audit logs for each deleted issue
  for (const issue of existingIssues) {
    try {
      await createAuditLog({
        action: 'issue.deleted',
        userId,
        organizationId: issue.organizationId,
        resourceType: 'issue',
        resourceId: issue.id,
        changes: {
          status: { from: issue.status, to: 'deleted' },
        },
        metadata: { bulkOperation: true },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  return NextResponse.json({
    success: true,
    deletedCount: existingIssues.length,
  });
}

