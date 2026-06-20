import { db, organizationMembers, projectMembers } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { hasPermission } from '@/lib/auth/permissions';

const PROJECT_MAINTAINER_ROLES = new Set(['product_owner', 'scrum_master', 'tech_lead']);

export async function canManageAgentApprovals(params: {
  userId: string;
  workspaceId: string;
  projectId?: string | null;
}) {
  if (await hasPermission(params.workspaceId, 'org:manage')) return true;

  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, params.userId),
        eq(organizationMembers.organizationId, params.workspaceId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  if (member?.role === 'admin' || member?.role === 'owner') return true;

  if (!params.projectId) return false;

  const [projectMember] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.userId, params.userId), eq(projectMembers.projectId, params.projectId))
    )
    .limit(1);

  return PROJECT_MAINTAINER_ROLES.has(projectMember?.role ?? '');
}
