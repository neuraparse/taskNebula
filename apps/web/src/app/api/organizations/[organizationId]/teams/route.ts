import { NextRequest, NextResponse } from 'next/server';
import { db, teams, teamMembers } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq } from 'drizzle-orm';

// GET /api/organizations/[organizationId]/teams - Get teams in organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await params;

    // Get teams in organization
    const orgTeams = await db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, organizationId));

    // Get user's team memberships
    const userTeamMemberships = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, session.user.id));

    const userTeamIds = new Set(userTeamMemberships.map((tm) => tm.teamId));

    return NextResponse.json({
      teams: orgTeams.map((team) => ({
        ...team,
        isMember: userTeamIds.has(team.id),
      })),
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

