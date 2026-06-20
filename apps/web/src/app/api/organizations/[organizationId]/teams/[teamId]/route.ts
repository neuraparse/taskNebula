import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, db, eq, ne, organizationMembers, teamMembers, teams } from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

const updateTeamspaceSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
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

async function ensureAvailableSlug(organizationId: string, input: string, excludeTeamId: string) {
  const candidate = slugifyTeamspaceName(input);
  const [existingTeamspace] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.organizationId, organizationId),
        eq(teams.slug, candidate),
        ne(teams.id, excludeTeamId)
      )
    )
    .limit(1);

  if (existingTeamspace) {
    throw new Error('A teamspace with this slug already exists');
  }

  return candidate;
}

async function ensureLeadMembership(organizationId: string, leadId?: string | null) {
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

  const [nextLeadMembership] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, nextLeadId)))
    .limit(1);

  if (nextLeadMembership) {
    await db
      .update(teamMembers)
      .set({
        role: 'lead',
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, nextLeadMembership.id));
    return;
  }

  await db.insert(teamMembers).values({
    teamId,
    userId: nextLeadId,
    role: 'lead',
  });
}

async function getTeamspace(organizationId: string, teamId: string) {
  const [teamspace] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
    .limit(1);

  return teamspace ?? null;
}

// PATCH /api/organizations/[organizationId]/teams/[teamId] - Update teamspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, teamId } = await params;
    const canManage = await hasPermission(organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only owners and admins can manage teamspaces.' },
        { status: 403 }
      );
    }

    const existingTeamspace = await getTeamspace(organizationId, teamId);
    if (!existingTeamspace) {
      return NextResponse.json({ error: 'Teamspace not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = updateTeamspaceSchema.parse(body);

    await ensureLeadMembership(organizationId, data.leadId);

    const nextSlug = data.slug
      ? await ensureAvailableSlug(organizationId, data.slug, teamId)
      : existingTeamspace.slug;

    const nextLeadId = data.leadId === undefined ? existingTeamspace.leadId : data.leadId;

    const [updatedTeamspace] = await db
      .update(teams)
      .set({
        name: data.name?.trim() ?? existingTeamspace.name,
        slug: nextSlug,
        description:
          data.description === undefined
            ? existingTeamspace.description
            : data.description?.trim() || null,
        avatarUrl:
          data.avatarUrl === undefined
            ? existingTeamspace.avatarUrl
            : data.avatarUrl?.trim() || null,
        leadId: nextLeadId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamId))
      .returning();

    if (nextLeadId !== existingTeamspace.leadId) {
      await syncLeadMembership(teamId, existingTeamspace.leadId, nextLeadId ?? null);
    }

    return NextResponse.json({ team: updatedTeamspace });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (
        error.message === 'A teamspace with this slug already exists' ||
        error.message === 'Selected lead must be an organization member'
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error('Error updating teamspace:', error);
    return NextResponse.json({ error: 'Failed to update teamspace' }, { status: 500 });
  }
}

// DELETE /api/organizations/[organizationId]/teams/[teamId] - Delete teamspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, teamId } = await params;
    const canManage = await hasPermission(organizationId, 'org:settings');
    if (!canManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only owners and admins can manage teamspaces.' },
        { status: 403 }
      );
    }

    const teamspace = await getTeamspace(organizationId, teamId);
    if (!teamspace) {
      return NextResponse.json({ error: 'Teamspace not found' }, { status: 404 });
    }

    await db.delete(teams).where(eq(teams.id, teamId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teamspace:', error);
    return NextResponse.json({ error: 'Failed to delete teamspace' }, { status: 500 });
  }
}
