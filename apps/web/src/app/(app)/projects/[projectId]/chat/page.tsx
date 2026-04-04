import { ChatShell } from '@/components/chat/chat-shell';

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ChatShell projectId={projectId} />;
}
