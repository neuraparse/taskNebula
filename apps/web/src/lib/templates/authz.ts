import {
  and,
  db,
  eq,
  hasPermission as roleHasPermission,
  organizationMembers,
  users,
} from '@tasknebula/db';

/**
 * Shared helper: is the calling user allowed to administer templates in the
 * given organization? Uses the org:settings permission. Any org member may
 * list + use.
 */
export async function getTemplateAuthz(userId: string, organizationId: string | null) {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const isSuperAdmin = user?.isSuperAdmin === true;

  if (!organizationId) {
    return { isSuperAdmin, isMember: isSuperAdmin, canAdminister: isSuperAdmin };
  }

  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  const isMember = Boolean(member);
  const canAdminister = roleHasPermission(member?.role || '', 'org:settings', isSuperAdmin);
  return { isSuperAdmin, isMember: isMember || isSuperAdmin, canAdminister };
}
