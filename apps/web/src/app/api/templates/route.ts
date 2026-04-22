import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  and,
  db,
  desc,
  eq,
  inArray,
  organizationMembers,
  projectTemplates,
  users,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { getTemplateAuthz } from '@/lib/templates/authz';

export const dynamic = 'force-dynamic';

const TEMPLATE_KINDS = ['project', 'issue', 'doc'] as const;
type TemplateKind = (typeof TEMPLATE_KINDS)[number];

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  kind: z.enum(TEMPLATE_KINDS).default('project'),
  category: z.string().max(64).optional(),
  icon: z.string().max(64).optional().nullable(),
  color: z.string().max(32).optional().nullable(),
  payload: z.record(z.any()).default({}),
  organizationId: z.string().optional(),
});

// GET /api/templates — list templates visible to the caller.
// Scope:
//  - super admin: all templates (optionally filtered by ?organizationId)
//  - org member:  templates in their orgs + public verified templates
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const organizationIdParam = searchParams.get('organizationId');
    const kindParam = searchParams.get('kind');

    const [user] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const orgMemberships = await db
      .select({
        organizationId: organizationMembers.organizationId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    let orgIds = orgMemberships.map((m) => m.organizationId);
    if (organizationIdParam) {
      if (!user?.isSuperAdmin && !orgIds.includes(organizationIdParam)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      orgIds = [organizationIdParam];
    }

    const whereClauses = [] as any[];
    if (!user?.isSuperAdmin) {
      if (orgIds.length === 0) {
        return NextResponse.json({ templates: [] });
      }
      whereClauses.push(inArray(projectTemplates.organizationId, orgIds));
    } else if (organizationIdParam) {
      whereClauses.push(eq(projectTemplates.organizationId, organizationIdParam));
    }
    if (kindParam && (TEMPLATE_KINDS as readonly string[]).includes(kindParam)) {
      whereClauses.push(eq(projectTemplates.kind, kindParam));
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    const rows = await db
      .select({
        id: projectTemplates.id,
        organizationId: projectTemplates.organizationId,
        name: projectTemplates.name,
        description: projectTemplates.description,
        category: projectTemplates.category,
        icon: projectTemplates.icon,
        color: projectTemplates.color,
        kind: projectTemplates.kind,
        payload: projectTemplates.payload,
        usageCount: projectTemplates.usageCount,
        isPublic: projectTemplates.isPublic,
        createdBy: projectTemplates.createdBy,
        createdAt: projectTemplates.createdAt,
        updatedAt: projectTemplates.updatedAt,
      })
      .from(projectTemplates)
      .where(where as any)
      .orderBy(desc(projectTemplates.updatedAt));

    // Tell the caller, for each org, whether they can administer so the UI
    // can show/hide the "+ New template" / edit / delete affordances.
    const adminOrgIds = new Set(
      user?.isSuperAdmin
        ? orgIds
        : orgMemberships
            .filter((m) => m.role === 'owner' || m.role === 'admin')
            .map((m) => m.organizationId)
    );

    return NextResponse.json({
      templates: rows,
      canAdminister: user?.isSuperAdmin || adminOrgIds.size > 0,
      adminOrganizationIds: Array.from(adminOrgIds),
      memberOrganizationIds: orgIds,
    });
  } catch (error) {
    console.error('[api/templates] GET failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/templates — create a template. Admin-only within the target org.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    // Resolve organization: explicit or the caller's first admin org.
    let organizationId = data.organizationId ?? null;
    if (!organizationId) {
      const [adminMembership] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            inArray(organizationMembers.role, ['owner', 'admin'])
          )
        )
        .limit(1);
      organizationId = adminMembership?.organizationId ?? null;
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'You must be an owner or admin of an organization to create templates.' },
        { status: 403 }
      );
    }

    const authz = await getTemplateAuthz(userId, organizationId);
    if (!authz.canAdminister) {
      return NextResponse.json(
        { error: 'Only organization owners or admins can create templates.' },
        { status: 403 }
      );
    }

    const [inserted] = await db
      .insert(projectTemplates)
      .values({
        organizationId,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? 'custom',
        icon: data.icon ?? null,
        color: data.color ?? null,
        kind: data.kind,
        payload: data.payload ?? {},
        createdBy: userId,
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[api/templates] POST failed', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
