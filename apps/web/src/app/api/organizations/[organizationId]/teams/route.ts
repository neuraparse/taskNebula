import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import {
  and,
  asc,
  db,
  eq,
  inArray,
  ne,
  organizationMembers,
  projects,
  teamMembers,
  teams,
  users,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

const teamspaceSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  avatarUrl: z.union([z.string().url(), z.literal('')]).optional(),
  leadId: z.string().trim().nullable().optional(),
});

function slugifyTeamspaceName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return slug || 'teamspace';
}

async function ensureTeamspaceSlug(organizationId: string, input: string, excludeTeamId?: string) {
  const baseSlug = slugifyTeamspaceName(input);
  let candidate = baseSlug;
  let suffix = 2;

  for (;;) {
    const [existingTeamspace] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(
        excludeTeamId
          ? and(
              eq(teams.organizationId, organizationId),
              eq(teams.slug, candidate),
              ne(teams.id, excludeTeamId)
            )
          : and(eq(teams.organizationId, organizationId), eq(teams.slug, candidate))
      )
      .limit(1);

    if (!existingTeamspace) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function validateLeadMembership(organizationId: string, leadId?: string | null) {
  if (!leadId) {
    return;
  }

  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, leadId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  if (!member) {
    throw new Error('Selected lead must be an organization member');
  }
}

async function syncLeadMembership(
  teamId: string,
  previousLeadId: string | null,
  nextLeadId: string | null
) {
  if (previousLeadId && previousLeadId !== nextLeadId) {
    const [previousLeadMembership] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, previousLeadId)))
      .limit(1);

    if (previousLeadMembership) {
      await db
        .update(teamMembers)
        .set({
          role: 'member',
          updatedAt: new Date(),
        })
        .where(eq(teamMembers.id, previousLeadMembership.id));
    }
  }

  if (!nextLeadId) {
    return;
  }

  const [existingLeadMembership] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, nextLeadId)))
    .limit(1);

  if (existingLeadMembership) {
    await db
      .update(teamMembers)
      .set({
        role: 'lead',
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, existingLeadMembership.id));
    return;
  }

  await db.insert(teamMembers).values({
    id: createId(),
    teamId,
    userId: nextLeadId,
    role: 'lead',
  });
}

async function serializeTeamspaces(organizationId: string, userId: string) {
  const orgTeamspaces = await db
    .select()
    .from(teams)
    .where(eq(teams.organizationId, organizationId))
    .orderBy(asc(teams.name));

  if (orgTeamspaces.length === 0) {
    return [];
  }

  const teamspaceIds = orgTeamspaces.map((teamspace) => teamspace.id);
  const leadIds = Array.from(
    new Set(
      orgTeamspaces
        .map((teamspace) => teamspace.leadId)
        .filter((leadId): leadId is string => Boolean(leadId))
    )
  );

  const [userMemberships, allMemberships, assignedProjects, leadUsers] = await Promise.all([
    db
      .select({ teamId: teamMembers.teamId, role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), inArray(teamMembers.teamId, teamspaceIds))),
    db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, teamspaceIds)),
    db
      .select({ teamId: projects.teamId })
      .from(projects)
      .where(
        and(eq(projects.organizationId, organizationId), inArray(projects.teamId, teamspaceIds))
      ),
    leadIds.length > 0
      ? db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(inArray(users.id, leadIds))
      : Promise.resolve([]),
  ]);

  const membershipCounts = new Map<string, number>();
  for (const membership of allMemberships) {
    membershipCounts.set(membership.teamId, (membershipCounts.get(membership.teamId) ?? 0) + 1);
  }

  const projectCounts = new Map<string, number>();
  for (const project of assignedProjects) {
    if (!project.teamId) {
      continue;
    }

    projectCounts.set(project.teamId, (projectCounts.get(project.teamId) ?? 0) + 1);
  }

  const currentUserMemberships = new Map(
    userMemberships.map((membership) => [membership.teamId, membership.role] as const)
  );
  const leadById = new Map(leadUsers.map((lead) => [lead.id, lead]));

  return orgTeamspaces.map((teamspace) => ({
    ...teamspace,
    isMember: currentUserMemberships.has(teamspace.id),
    currentUserRole: currentUserMemberships.get(teamspace.id) ?? null,
    memberCount: membershipCounts.get(teamspace.id) ?? 0,
    projectCount: projectCounts.get(teamspace.id) ?? 0,
    lead: teamspace.leadId ? (leadById.get(teamspace.leadId) ?? null) : null,
  }));
}

// GET /api/organizations/[organizationId]/teams - List teamspaces in organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;
    const canView = await hasPermission(organizationId, 'org:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const teamspaces = await serializeTeamspaces(organizationId, session.user.id);

    return NextResponse.json({ teams: teamspaces });
  } catch (error) {
    console.error('Error fetching teamspaces:', error);
    return NextResponse.json({ error: 'Failed to fetch teamspaces' }, { status: 500 });
  }
}

// POST /api/organizations/[organizationId]/teams - Create teamspace
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;
    const canManage = await hasPermission(organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only owners and admins can manage teamspaces.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = teamspaceSchema.parse(body);

    await validateLeadMembership(organizationId, data.leadId);

    const slug = await ensureTeamspaceSlug(organizationId, data.slug?.trim() || data.name);

    const [createdTeamspace] = await db
      .insert(teams)
      .values({
        id: createId(),
        organizationId,
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        avatarUrl: data.avatarUrl?.trim() || null,
        leadId: data.leadId ?? session.user.id,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!createdTeamspace) {
      throw new Error('Failed to create teamspace');
    }

    const memberships = new Map<string, 'lead' | 'member'>();
    const initialLeadId = data.leadId ?? session.user.id;
    memberships.set(initialLeadId, 'lead');

    if (session.user.id !== initialLeadId) {
      memberships.set(session.user.id, 'member');
    }

    await db.insert(teamMembers).values(
      Array.from(memberships.entries()).map(([userId, role]) => ({
        id: createId(),
        teamId: createdTeamspace.id,
        userId,
        role,
      }))
    );

    const [teamspace] = await serializeTeamspaces(organizationId, session.user.id).then((items) =>
      items.filter((item) => item.id === createdTeamspace.id)
    );

    return NextResponse.json({ team: teamspace ?? createdTeamspace }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message === 'Selected lead must be an organization member'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error creating teamspace:', error);
    return NextResponse.json({ error: 'Failed to create teamspace' }, { status: 500 });
  }
}
