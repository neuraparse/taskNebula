import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, db, eq, teamMembers, teams, users } from '@tasknebula/db';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/auth/permissions';

const updateTeamMemberSchema = z.object({
  role: z.enum(['lead', 'member']),
});

async function getTeamspace(organizationId: string, teamId: string) {
  const [teamspace] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.organizationId, organizationId), eq(teams.id, teamId)))
    .limit(1);

  return teamspace ?? null;
}

async function getTeamspaceMember(teamId: string, memberId: string) {
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberId)))
    .limit(1);

  return member ?? null;
}

async function updateLead(teamId: string, previousLeadId: string | null, nextLeadId: string | null) {
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

// PATCH /api/organizations/[organizationId]/teams/[teamId]/members/[memberId] - Update teamspace member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; teamId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, teamId, memberId } = await params;
    const canManage = await hasPermission(organizationId, 'member:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const teamspace = await getTeamspace(organizationId, teamId);
    if (!teamspace) {
      return NextResponse.json({ error: 'Teamspace not found' }, { status: 404 });
    }

    const existingMember = await getTeamspaceMember(teamId, memberId);
    if (!existingMember) {
      return NextResponse.json({ error: 'Teamspace member not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = updateTeamMemberSchema.parse(body);

    const [updatedMember] = await db
      .update(teamMembers)
      .set({
        role: data.role,
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, existingMember.id))
      .returning();

    if (!updatedMember) {
      throw new Error('Failed to update team member');
    }

    if (data.role === 'lead') {
      await updateLead(teamId, teamspace.leadId, memberId);
    } else if (teamspace.leadId === memberId) {
      await updateLead(teamId, teamspace.leadId, null);
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
      .where(eq(users.id, memberId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    return NextResponse.json({
      member: {
        id: user.id,
        teamRole: updatedMember.role,
        joinedAt: updatedMember.createdAt,
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

    console.error('Error updating teamspace member:', error);
    return NextResponse.json({ error: 'Failed to update teamspace member' }, { status: 500 });
  }
}

// DELETE /api/organizations/[organizationId]/teams/[teamId]/members/[memberId] - Remove teamspace member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; teamId: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, teamId, memberId } = await params;
    const canManage = await hasPermission(organizationId, 'member:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (memberId === session.user.id) {
      return NextResponse.json(
        { error: 'Remove yourself from the teamspace from another admin account.' },
        { status: 400 }
      );
    }

    const teamspace = await getTeamspace(organizationId, teamId);
    if (!teamspace) {
      return NextResponse.json({ error: 'Teamspace not found' }, { status: 404 });
    }

    const member = await getTeamspaceMember(teamId, memberId);
    if (!member) {
      return NextResponse.json({ error: 'Teamspace member not found' }, { status: 404 });
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, member.id));

    if (teamspace.leadId === memberId) {
      await updateLead(teamId, teamspace.leadId, null);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing teamspace member:', error);
    return NextResponse.json({ error: 'Failed to remove teamspace member' }, { status: 500 });
  }
}
