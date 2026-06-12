import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, labels } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';
import { renameLabelInIssuesJsonbSql, removeLabelFromIssuesJsonbSql } from '@/lib/labels/jsonb';

export const dynamic = 'force-dynamic';

const updateLabelSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #6B7280')
    .optional(),
  description: z.string().max(2000).nullable().optional(),
});

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

/** Load the label and verify the caller belongs to its organization. */
async function loadAuthorizedLabel(userId: string, labelId: string) {
  const [label] = await db.select().from(labels).where(eq(labels.id, labelId)).limit(1);
  if (!label) {
    return {
      label: null,
      response: NextResponse.json({ error: 'Label not found' }, { status: 404 }),
    };
  }
  if (!(await isActiveOrganizationMember(userId, label.organizationId))) {
    return { label: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { label, response: null };
}

// PATCH /api/labels/[labelId] - Rename / recolor / re-describe a label.
// On rename, the legacy issues.labels jsonb arrays in the org are updated in
// the same transaction (single UPDATE, see lib/labels/jsonb.ts).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { labelId } = await params;
    const body = await request.json();
    const validatedData = updateLabelSchema.parse(body);

    const { label, response } = await loadAuthorizedLabel(session.user.id, labelId);
    if (!label) return response;

    const oldName = label.name;
    const newName = validatedData.name;
    const renaming = newName !== undefined && newName !== oldName;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(labels)
        .set({
          ...(newName !== undefined ? { name: newName } : {}),
          ...(validatedData.color !== undefined ? { color: validatedData.color } : {}),
          ...(validatedData.description !== undefined
            ? { description: validatedData.description }
            : {}),
          updatedAt: new Date(),
        })
        // Org condition is defense-in-depth: loadAuthorizedLabel already
        // verified membership, but the mutation re-asserts the scope.
        .where(and(eq(labels.id, labelId), eq(labels.organizationId, label.organizationId)))
        .returning();

      if (renaming && newName) {
        // Write-through: keep the jsonb contract (`issues.labels`) in step.
        await tx.execute(
          renameLabelInIssuesJsonbSql({
            organizationId: label.organizationId,
            oldName,
            newName,
          })
        );
      }

      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A label with this name already exists in this scope' },
        { status: 409 }
      );
    }
    console.error('Error updating label:', error);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

// DELETE /api/labels/[labelId] - Delete a label. issue_labels rows cascade via
// FK; the name is also removed from issues.labels jsonb arrays org-wide.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { labelId } = await params;

    const { label, response } = await loadAuthorizedLabel(session.user.id, labelId);
    if (!label) return response;

    await db.transaction(async (tx) => {
      await tx
        .delete(labels)
        .where(and(eq(labels.id, labelId), eq(labels.organizationId, label.organizationId)));
      await tx.execute(
        removeLabelFromIssuesJsonbSql({
          organizationId: label.organizationId,
          name: label.name,
        })
      );
    });

    return NextResponse.json({ success: true, id: labelId });
  } catch (error) {
    console.error('Error deleting label:', error);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}
