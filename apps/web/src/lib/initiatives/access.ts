import { db, initiatives, organizationMembers, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

export type InitiativeAccess = {
  initiative: typeof initiatives.$inferSelect | null;
  canRead: boolean;
};

export async function resolveInitiativeAccess(
  userId: string,
  initiativeId: string
): Promise<InitiativeAccess> {
  const [initiative] = await db
    .select()
    .from(initiatives)
    .where(eq(initiatives.id, initiativeId))
    .limit(1);

  if (!initiative) {
    return { initiative: null, canRead: false };
  }

  const usersTable = users as typeof users | undefined;
  if (usersTable) {
    const [user] = await db
      .select({ isSuperAdmin: usersTable.isSuperAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (user?.isSuperAdmin) {
      return { initiative, canRead: true };
    }
  }

  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, initiative.workspaceId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  return { initiative, canRead: Boolean(membership) };
}
