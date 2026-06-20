import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, db, eq, organizationMembers, teamMembers, teams, users } from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

const teamMemberSchema = z.object({
  userId: z.string().trim().min(1),
  role: z.enum(['lead', 'member']).default('member'),
});

async function getTeamspace(organizationId: string, teamId: string) {
  const [teamspace] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
    .limit(1);

  return teamspace ?? null;
}

async function ensureOrgMember(organizationId: string, userId: string) {
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  return member ?? null;
}

async function setLead(teamId: string, previousLeadId: string | null, nextLeadId: string | null) {
  if (previousLeadId && previousLeadId !== nextLeadId) {
    const [previousLead] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, previousLeadId)))
      .limit(1);

    if (previousLead) {
      await db
        .update(teamMembers)
        .set({
          role: 'member',
          updatedAt: new Date(),
        })
        .where(eq(teamMembers.id, previousLead.id));
    }
  }

  await db
    .update(teams)
    .set({
      leadId: nextLeadId,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

async function listTeamspaceMembers(teamId: string) {
  const rows = await db
    .select({
      id: users.id,
      teamRole: teamMembers.role,
      joinedAt: teamMembers.createdAt,
      name: users.name,
      email: users.email,
      image: users.image,
      status: users.status,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(users.name));

  return rows.sort((left, right) => {
    if (left.teamRole === right.teamRole) {
      return (left.name || left.email || '').localeCompare(right.name || right.email || '');
    }

    return left.teamRole === 'lead' ? -1 : 1;
  });
}

// GET /api/organizations/[organizationId]/teams/[teamId]/members - List members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, teamId } = await params;
    const canView = await hasPermission(organizationId, 'member:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const teamspace = await getTeamspace(organizationId, teamId);
    if (!teamspace) {
      return NextResponse.json({ error: 'Teamspace not found' }, { status: 404 });
    }

    const members = await listTeamspaceMembers(teamId);

    return NextResponse.json({
      team: teamspace,
      members,
    });
  } catch (error) {
    console.error('Error fetching teamspace members:', error);
    return NextResponse.json({ error: 'Failed to fetch teamspace members' }, { status: 500 });
  }
}

// POST /api/organizations/[organizationId]/teams/[teamId]/members - Add member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, teamId } = await params;
    const canManage = await hasPermission(organizationId, 'member:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const teamspace = await getTeamspace(organizationId, teamId);
    if (!teamspace) {
      return NextResponse.json({ error: 'Teamspace not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = teamMemberSchema.parse(body);

    const orgMember = await ensureOrgMember(organizationId, data.userId);
    if (!orgMember) {
      return NextResponse.json(
        { error: 'Selected user must be part of the organization first' },
        { status: 400 }
      );
    }

    const [existingMember] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, data.userId)))
      .limit(1);

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a teamspace member' }, { status: 400 });
    }

    const [createdMember] = await db
      .insert(teamMembers)
      .values({
        teamId,
        userId: data.userId,
        role: data.role,
      })
      .returning();

    if (!createdMember) {
      throw new Error('Failed to create team member');
    }

    if (data.role === 'lead') {
      await setLead(teamId, teamspace.leadId, data.userId);
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    return NextResponse.json({
      member: {
        id: user.id,
        teamRole: createdMember.role,
        joinedAt: createdMember.createdAt,
        name: user.name,
        email: user.email,
        image: user.image,
        status: user.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error adding teamspace member:', error);
    return NextResponse.json({ error: 'Failed to add teamspace member' }, { status: 500 });
  }
}
