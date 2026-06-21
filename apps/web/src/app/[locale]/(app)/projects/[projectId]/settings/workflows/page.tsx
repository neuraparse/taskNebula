import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ProjectAccessDenied } from '@/components/projects/project-access-denied';
import { resolveProjectCapabilityAccess } from '@/lib/auth/project-access';
import { ProjectWorkflowsClient } from './workflows-client';

export default async function ProjectWorkflowsSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/projects/${projectId}/settings/workflows`);
  }

  const access = await resolveProjectCapabilityAccess(session.user.id, projectId);
  const canAccess =
    access.canRead &&
    (access.canManage ||
      access.isSuperAdmin ||
      access.isOrgOwner ||
      access.isOrgAdmin ||
      access.permissions.canManageWorkflow);

  if (!canAccess) {
    return <ProjectAccessDenied />;
  }

  return <ProjectWorkflowsClient projectId={projectId} />;
}
