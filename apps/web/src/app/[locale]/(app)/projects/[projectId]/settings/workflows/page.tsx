import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db, projects } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { hasPermission } from '@/lib/auth/permissions';
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

  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    redirect('/dashboard?error=insufficient-permission');
  }

  const canAccess =
    (await hasPermission(project.organizationId, 'project:settings')) ||
    (await hasPermission(project.organizationId, 'project:manage'));

  if (!canAccess) {
    redirect('/dashboard?error=insufficient-permission');
  }

  return <ProjectWorkflowsClient projectId={projectId} />;
}
