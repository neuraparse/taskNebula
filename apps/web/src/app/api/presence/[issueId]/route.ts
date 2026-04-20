import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  issues,
  organizationMembers,
  projectMembers,
  users,
} from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

// In-memory store for presence (in production, use Redis)
const presenceStore = new Map<
  string,
  Map<string, { userId: string; userName: string; userEmail: string; lastSeen: number }>
>();

const PRESENCE_TIMEOUT = 60000; // 60 seconds

/**
 * Verify the caller can see the given issue — super admin,
 * org owner/admin, or a member of the owning project.
 */
async function userCanAccessIssue(userId: string, issueId: string): Promise<'ok' | 'not_found' | 'forbidden'> {
  const [issue] = await db
    .select({ projectId: issues.projectId, organizationId: issues.organizationId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) return 'not_found';

  const [currentUser] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (currentUser?.isSuperAdmin) return 'ok';

  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, issue.organizationId)
      )
    )
    .limit(1);

  if (orgMember?.role === 'owner' || orgMember?.role === 'admin') return 'ok';

  const [projectMember] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, issue.projectId)
      )
    )
    .limit(1);

  return projectMember ? 'ok' : 'forbidden';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    const access = await userCanAccessIssue(session.user.id, issueId);
    if (access === 'not_found') {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (access === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get active users for this issue
    const issuePresence = presenceStore.get(issueId);
    if (!issuePresence) {
      return NextResponse.json({ users: [] });
    }

    // Clean up stale presence
    const now = Date.now();
    const activeUsers = Array.from(issuePresence.values()).filter((user) => {
      if (now - user.lastSeen > PRESENCE_TIMEOUT) {
        issuePresence.delete(user.userId);
        return false;
      }
      return true;
    });

    return NextResponse.json({ users: activeUsers });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    const access = await userCanAccessIssue(session.user.id, issueId);
    if (access === 'not_found') {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (access === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create presence map for this issue
    let issuePresence = presenceStore.get(issueId);
    if (!issuePresence) {
      issuePresence = new Map();
      presenceStore.set(issueId, issuePresence);
    }

    // Update user presence
    issuePresence.set(session.user.id, {
      userId: session.user.id,
      userName: session.user.name || session.user.email || 'Unknown',
      userEmail: session.user.email || 'unknown@example.com',
      lastSeen: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Remove user from presence
    const issuePresence = presenceStore.get(issueId);
    if (issuePresence) {
      issuePresence.delete(session.user.id);

      // Clean up empty maps
      if (issuePresence.size === 0) {
        presenceStore.delete(issueId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
