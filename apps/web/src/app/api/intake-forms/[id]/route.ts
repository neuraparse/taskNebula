import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, intakeForms, organizationMembers } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { intakeFieldsArraySchema } from '@/lib/intake/schema';

export const dynamic = 'force-dynamic';

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const patchIntakeFormSchema = z.object({
  slug: z.string().min(2).max(64).regex(slugRegex).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  fields: intakeFieldsArraySchema.optional(),
  isPublic: z.boolean().optional(),
  requiresCaptcha: z.boolean().optional(),
  targetStatus: z.string().max(64).optional(),
  autoAssignUserId: z.string().optional().nullable(),
  customStyling: z.record(z.unknown()).optional(),
});

/**
 * Verify the caller is a member of the org that owns the form. Returns
 * the form on success or a NextResponse on failure (so callers can
 * early-return either way).
 */
async function loadFormForCaller(
  formId: string,
  userId: string,
): Promise<{ ok: true; form: typeof intakeForms.$inferSelect } | { ok: false; response: NextResponse }> {
  const [form] = await db
    .select()
    .from(intakeForms)
    .where(eq(intakeForms.id, formId))
    .limit(1);

  if (!form) {
    return { ok: false, response: NextResponse.json({ error: 'Form not found' }, { status: 404 }) };
  }

  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, form.workspaceId),
      ),
    )
    .limit(1);

  if (!member) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, form };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await loadFormForCaller(id, session.user.id);
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const patch = patchIntakeFormSchema.parse(body);

    if (patch.slug && patch.slug !== guard.form.slug) {
      const [existing] = await db
        .select({ id: intakeForms.id })
        .from(intakeForms)
        .where(eq(intakeForms.slug, patch.slug))
        .limit(1);
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'A form with that slug already exists' },
          { status: 409 },
        );
      }
    }

    // Only touch fields the caller explicitly supplied — mirrors the
    // drafts PATCH pattern so admin edits don't accidentally wipe optional
    // fields that the client omitted from the diff.
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.slug !== undefined) updateSet.slug = patch.slug;
    if (patch.title !== undefined) updateSet.title = patch.title;
    if (patch.description !== undefined) updateSet.description = patch.description;
    if (patch.fields !== undefined) updateSet.fields = patch.fields;
    if (patch.isPublic !== undefined) updateSet.isPublic = patch.isPublic;
    if (patch.requiresCaptcha !== undefined) updateSet.requiresCaptcha = patch.requiresCaptcha;
    if (patch.targetStatus !== undefined) updateSet.targetStatus = patch.targetStatus;
    if (patch.autoAssignUserId !== undefined) updateSet.autoAssignUserId = patch.autoAssignUserId;
    if (patch.customStyling !== undefined) updateSet.customStyling = patch.customStyling;

    const [updated] = await db
      .update(intakeForms)
      .set(updateSet)
      .where(eq(intakeForms.id, id))
      .returning();

    return NextResponse.json({ form: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      );
    }
    console.error('Update intake form error:', error);
    return NextResponse.json({ error: 'Failed to update intake form' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await loadFormForCaller(id, session.user.id);
    if (!guard.ok) return guard.response;

    await db.delete(intakeForms).where(eq(intakeForms.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete intake form error:', error);
    return NextResponse.json({ error: 'Failed to delete intake form' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const guard = await loadFormForCaller(id, session.user.id);
    if (!guard.ok) return guard.response;

    return NextResponse.json({ form: guard.form });
  } catch (error) {
    console.error('Get intake form error:', error);
    return NextResponse.json({ error: 'Failed to get intake form' }, { status: 500 });
  }
}
