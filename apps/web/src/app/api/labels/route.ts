import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, labels, issueLabels, projects } from '@tasknebula/db';
import { and, asc, count, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const createLabelSchema = z.object({
  organizationId: z.string().min(1),
  // Optional project scope; NULL/absent = org-wide label.
  projectId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(100),
  color: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color like #6B7280')
    .optional(),
  description: z.string().max(2000).nullable().optional(),
});

/** Escape LIKE wildcards so `?q=` is a literal prefix match. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

// GET /api/labels?organizationId=xxx[&projectId=xxx][&q=prefix]
// Lists the org's labels (with usage counts). When projectId is given,
// returns that project's labels PLUS org-wide ones (project_id IS NULL).
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');
    const q = searchParams.get('q');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    if (!(await isActiveOrganizationMember(session.user.id, organizationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const conditions: SQL[] = [eq(labels.organizationId, organizationId)];

    if (projectId) {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      const projectScope = or(isNull(labels.projectId), eq(labels.projectId, projectId));
      if (projectScope) {
        conditions.push(projectScope);
      }
    }

    if (q) {
      conditions.push(ilike(labels.name, `${escapeLikePattern(q)}%`));
    }

    const rows = await db
      .select({
        id: labels.id,
        organizationId: labels.organizationId,
        projectId: labels.projectId,
        name: labels.name,
        color: labels.color,
        description: labels.description,
        createdAt: labels.createdAt,
        updatedAt: labels.updatedAt,
        createdBy: labels.createdBy,
        usageCount: count(issueLabels.issueId),
      })
      .from(labels)
      .leftJoin(issueLabels, eq(issueLabels.labelId, labels.id))
      .where(and(...conditions))
      .groupBy(labels.id)
      .orderBy(asc(labels.name));

    return NextResponse.json({ labels: rows });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}

// POST /api/labels - Create a label (org-wide, or project-scoped via projectId)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createLabelSchema.parse(body);

    if (!(await isActiveOrganizationMember(session.user.id, validatedData.organizationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (validatedData.projectId) {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, validatedData.projectId),
            eq(projects.organizationId, validatedData.organizationId)
          )
        )
        .limit(1);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const [newLabel] = await db
      .insert(labels)
      .values({
        id: createId(),
        organizationId: validatedData.organizationId,
        projectId: validatedData.projectId ?? null,
        name: validatedData.name,
        // Omit color when not provided so the schema default (#6B7280) applies.
        ...(validatedData.color ? { color: validatedData.color } : {}),
        description: validatedData.description ?? null,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(newLabel, { status: 201 });
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
    console.error('Error creating label:', error);
    return NextResponse.json({ error: 'Failed to create label' }, { status: 500 });
  }
}
