import { db, organizationMembers, projects, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

/**
 * Resolve a project by its CUID2 id or by its project key.
 *
 * Project keys are only unique per organization, so the key-lookup branch
 * MUST be scoped to organizations the calling user belongs to — an unscoped
 * key lookup resolves projects across tenants. Pass `userId` whenever the
 * lookup happens on behalf of a request. Super admins resolve across all
 * organizations.
 *
 * When `userId` is omitted (trusted internal callers only), the legacy
 * unscoped key lookup is preserved; callers are then responsible for
 * authorizing access to the resolved project's organization themselves.
 */
export async function resolveProjectByIdOrKey(projectIdOrKey: string, userId?: string) {
  let [project] = await db.select().from(projects).where(eq(projects.id, projectIdOrKey)).limit(1);

  if (!project) {
    const key = projectIdOrKey.toUpperCase();

    let scopeToUserOrgs = false;
    if (userId !== undefined) {
      const [user] = await db
        .select({ isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      scopeToUserOrgs = !user?.isSuperAdmin;
    }

    if (userId !== undefined && scopeToUserOrgs) {
      const [match] = await db
        .select({ project: projects })
        .from(projects)
        .innerJoin(
          organizationMembers,
          and(
            eq(organizationMembers.organizationId, projects.organizationId),
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.status, 'active')
          )
        )
        .where(eq(projects.key, key))
        .limit(1);
      project = match?.project;
    } else {
      [project] = await db.select().from(projects).where(eq(projects.key, key)).limit(1);
    }
  }

  return project ?? null;
}

/**
 * Resolve a project id from an id-or-key, scoped the same way as
 * {@link resolveProjectByIdOrKey}.
 */
export async function resolveProjectId(
  projectIdOrKey: string,
  userId?: string
): Promise<string | null> {
  const project = await resolveProjectByIdOrKey(projectIdOrKey, userId);
  return project?.id ?? null;
}
