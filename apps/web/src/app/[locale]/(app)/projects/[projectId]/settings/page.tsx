import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ProjectAccessDenied } from '@/components/projects/project-access-denied';
import { resolveProjectCapabilityAccess } from '@/lib/auth/project-access';
import { ProjectSettingsClient } from './project-settings-client';

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/projects/${projectId}/settings`);
  }

  const access = await resolveProjectCapabilityAccess(session.user.id, projectId);
  const canAccess =
    access.canRead &&
    (access.canManage ||
      access.isSuperAdmin ||
      access.isOrgOwner ||
      access.isOrgAdmin ||
      access.permissions.canManageMembers ||
      access.permissions.canInviteMembers ||
      access.permissions.canChangeRoles ||
      access.permissions.canManageWorkflow);

  if (!canAccess) {
    return <ProjectAccessDenied />;
  }

  return <ProjectSettingsClient projectId={projectId} />;
}
