import { auth } from '@/auth';
import { getProjectAgentAccess } from '@/lib/agents/access';
import { createAgentStreamResponse } from '@/lib/agents/stream-response';
import { agentEventStream } from '@/lib/websocket/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { projectId } = await params;
  const access = await getProjectAgentAccess(session.user.id, projectId);
  if (!access.canView || !access.project) {
    return new Response('Forbidden', { status: 403 });
  }

  return createAgentStreamResponse(request, (onEvent) =>
    agentEventStream.subscribeProject(access.project!.id, onEvent)
  );
}
