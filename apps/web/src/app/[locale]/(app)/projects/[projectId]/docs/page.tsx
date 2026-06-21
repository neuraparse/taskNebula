import { auth } from '@/auth';
import { DocsShell } from '@/components/docs/docs-shell';
import { ProjectAccessDenied } from '@/components/projects/project-access-denied';
import { getProjectDocumentPermissions, getUserFlags } from '@/lib/docs/server';
import { resolveProjectAccess } from '@/lib/auth/project-access';
import { notFound, redirect } from 'next/navigation';

export default async function ProjectDocsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/projects/${encodeURIComponent(projectId)}/docs`);
  }

  const access = await resolveProjectAccess(session.user.id, projectId);
  if (!access.project || !access.canRead) {
    notFound();
  }

  const userFlags = await getUserFlags(session.user.id);
  const permissions = await getProjectDocumentPermissions(
    session.user.id,
    access.project.id,
    userFlags.isSuperAdmin
  );

  if (!permissions.canBrowse) {
    return <ProjectAccessDenied />;
  }

  return (
    <div className="animate-fade-in h-full min-h-0 overflow-hidden">
      <DocsShell projectId={projectId} />
    </div>
  );
}
