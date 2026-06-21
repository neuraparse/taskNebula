import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  and,
  db,
  eq,
  ilike,
  notInArray,
  or,
  organizationMembers,
  projectMembers,
  users,
} from '@tasknebula/db';
import { hasPermission } from '@/lib/auth/permissions';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT);
}

// GET /api/organizations/[organizationId]/member-candidates
// Returns users that can be added to a project. Existing workspace members are
// always available to users with member view access. Registered users outside
// the workspace are included only for callers allowed to invite workspace
// members, because selecting one auto-adds that user to the workspace.
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
    const canViewMembers = await hasPermission(organizationId, 'member:view');
    if (!canViewMembers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const canInviteMembers = await hasPermission(organizationId, 'member:invite');
    const search = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    const projectIdOrKey = request.nextUrl.searchParams.get('projectId')?.trim() ?? '';
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
    const project =
      projectIdOrKey.length > 0
        ? await resolveProjectByIdOrKey(projectIdOrKey, session.user.id)
        : null;
    const projectId = project?.organizationId === organizationId ? project.id : '';

    const projectMemberRows = projectId
      ? await db
          .select({ userId: projectMembers.userId })
          .from(projectMembers)
          .where(eq(projectMembers.projectId, projectId))
      : [];
    const existingProjectUserIds = new Set(projectMemberRows.map((row) => row.userId));

    const orgMembers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
        role: organizationMembers.role,
        memberStatus: organizationMembers.status,
      })
      .from(users)
      .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    const workspaceCandidates = orgMembers
      .filter((member) => member.memberStatus === 'active')
      .filter((member) => !existingProjectUserIds.has(member.id))
      .map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        image: member.image,
        status: member.status,
        role: member.role,
        source: 'organization_member' as const,
      }));

    let registeredCandidates: Array<{
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      status: string;
      role: null;
      source: 'registered_user';
    }> = [];

    if (canInviteMembers) {
      const orgMemberIds = new Set(orgMembers.map((member) => member.id));
      const excludedIds = Array.from(new Set([...orgMemberIds, ...existingProjectUserIds]));
      const filters = [eq(users.status, 'active')];
      if (excludedIds.length > 0) {
        filters.push(notInArray(users.id, excludedIds));
      }
      if (search) {
        const pattern = `%${search}%`;
        const searchFilter = or(ilike(users.name, pattern), ilike(users.email, pattern));
        if (searchFilter) {
          filters.push(searchFilter);
        }
      }

      const registeredUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          status: users.status,
        })
        .from(users)
        .where(and(...filters))
        .limit(limit);

      registeredCandidates = registeredUsers.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        status: user.status,
        role: null,
        source: 'registered_user' as const,
      }));
    }

    const allCandidates = [...workspaceCandidates, ...registeredCandidates];
    const needle = search.toLowerCase();
    const filteredCandidates = allCandidates
      .filter((candidate) => {
        if (!needle) return true;
        return (
          (candidate.name ?? '').toLowerCase().includes(needle) ||
          (candidate.email ?? '').toLowerCase().includes(needle)
        );
      })
      .slice(0, limit);

    return NextResponse.json({
      members: filteredCandidates,
      canInviteRegisteredUsers: canInviteMembers,
    });
  } catch (error) {
    console.error('Error fetching member candidates:', error);
    return NextResponse.json({ error: 'Failed to fetch member candidates' }, { status: 500 });
  }
}
