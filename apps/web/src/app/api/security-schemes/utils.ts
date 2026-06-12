import { db, issueSecuritySchemes } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { isActiveOrganizationMember } from '@/lib/auth/access-control';
import { hasPermission } from '@/lib/auth/permissions';

export type SecuritySchemeRow = typeof issueSecuritySchemes.$inferSelect;

export type SecuritySchemeAccess =
  | { status: 'not-found'; scheme: null }
  | { status: 'forbidden'; scheme: SecuritySchemeRow }
  | { status: 'ok'; scheme: SecuritySchemeRow };

/**
 * Resolve the scheme row and authorize against ITS organization_id (never
 * client input). Non-members get 'not-found' (404) so cross-org probing
 * cannot confirm the scheme exists; org members without `org:settings`
 * get 'forbidden' (403).
 */
export async function authorizeSecuritySchemeAccess(
  userId: string,
  schemeId: string
): Promise<SecuritySchemeAccess> {
  const [scheme] = await db
    .select()
    .from(issueSecuritySchemes)
    .where(eq(issueSecuritySchemes.id, schemeId))
    .limit(1);

  if (!scheme) {
    return { status: 'not-found', scheme: null };
  }
  if (!(await isActiveOrganizationMember(userId, scheme.organizationId))) {
    return { status: 'not-found', scheme: null };
  }
  if (!(await hasPermission(scheme.organizationId, 'org:settings'))) {
    return { status: 'forbidden', scheme };
  }
  return { status: 'ok', scheme };
}
