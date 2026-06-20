import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, intakeForms, organizationMembers, projects } from '@tasknebula/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { intakeFieldsArraySchema } from '@/lib/intake/schema';

export const dynamic = 'force-dynamic';

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const createIntakeFormSchema = z.object({
  projectId: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(slugRegex, 'slug must be lowercase letters, digits, and hyphens'),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  fields: intakeFieldsArraySchema,
  isPublic: z.boolean().optional(),
  requiresCaptcha: z.boolean().optional(),
  targetStatus: z.string().max(64).optional(),
  autoAssignUserId: z.string().optional().nullable(),
  customStyling: z.record(z.unknown()).optional(),
});

/**
 * GET /api/intake-forms — list intake forms visible to the caller.
 *
 * Optional `?projectId=...` narrows to one project. Without it, returns
 * every form across all organizations the caller belongs to. We do the
 * org-membership join in code (rather than SQL) because the org count
 * per user is small and the existing pattern in /api/issues already
 * does the same.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectIdParam = request.nextUrl.searchParams.get('projectId');

    const orgMemberships = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.status, 'active')
        )
      );

    const accessibleOrgIds = orgMemberships.map((m) => m.organizationId);
    if (accessibleOrgIds.length === 0) {
      return NextResponse.json({ forms: [] });
    }

    const conditions = [inArray(intakeForms.workspaceId, accessibleOrgIds)];
    if (projectIdParam) {
      conditions.push(eq(intakeForms.projectId, projectIdParam));
    }

    const forms = await db
      .select()
      .from(intakeForms)
      .where(and(...conditions))
      .orderBy(desc(intakeForms.updatedAt));

    return NextResponse.json({ forms });
  } catch (error) {
    console.error('List intake forms error:', error);
    return NextResponse.json({ error: 'Failed to list intake forms' }, { status: 500 });
  }
}

/**
 * POST /api/intake-forms — create a new intake form. The caller must
 * be a member of the project's organization. We resolve the workspace
 * id from the project rather than trusting the request body to avoid
 * cross-tenant form creation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createIntakeFormSchema.parse(body);

    const [project] = await db
      .select({ id: projects.id, organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, data.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [member] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, session.user.id),
          eq(organizationMembers.organizationId, project.organizationId),
          eq(organizationMembers.status, 'active')
        )
      )
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [existing] = await db
      .select({ id: intakeForms.id })
      .from(intakeForms)
      .where(eq(intakeForms.slug, data.slug))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: 'A form with that slug already exists' }, { status: 409 });
    }

    const [created] = await db
      .insert(intakeForms)
      .values({
        workspaceId: project.organizationId,
        projectId: data.projectId,
        slug: data.slug,
        title: data.title,
        description: data.description ?? null,
        fields: data.fields,
        isPublic: data.isPublic ?? true,
        requiresCaptcha: data.requiresCaptcha ?? false,
        targetStatus: data.targetStatus ?? 'triage',
        autoAssignUserId: data.autoAssignUserId ?? null,
        customStyling: data.customStyling ?? {},
      })
      .returning();

    return NextResponse.json({ form: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Create intake form error:', error);
    return NextResponse.json({ error: 'Failed to create intake form' }, { status: 500 });
  }
}
