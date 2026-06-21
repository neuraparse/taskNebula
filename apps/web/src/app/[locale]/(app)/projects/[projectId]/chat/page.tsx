import { auth } from '@/auth';
import { ChatShell } from '@/components/chat/chat-shell';
import { ProjectAccessDenied } from '@/components/projects/project-access-denied';
import { ChatAccessError, getProjectChatContext } from '@/lib/chat/server';
import { notFound, redirect } from 'next/navigation';

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/projects/${encodeURIComponent(projectId)}/chat`);
  }

  try {
    const context = await getProjectChatContext(session.user.id, projectId);
    if (!context.canView) {
      return <ProjectAccessDenied />;
    }
  } catch (error) {
    if (error instanceof ChatAccessError && error.status === 404) {
      notFound();
    }
    return <ProjectAccessDenied />;
  }

  return <ChatShell projectId={projectId} />;
}
