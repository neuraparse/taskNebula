import { auth } from '@/auth';
import { db, organizationMembers, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

export async function userHasWorkspaceAccess(userId: string): Promise<boolean> {
  const [actor] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (actor?.isSuperAdmin) {
    return true;
  }

  const [membership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
    .limit(1);

  return Boolean(membership);
}

export async function currentUserHasWorkspaceAccess(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) {
    return false;
  }

  return userHasWorkspaceAccess(session.user.id);
}
