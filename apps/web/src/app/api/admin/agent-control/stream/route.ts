import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { createAgentStreamResponse } from '@/lib/agents/stream-response';
import { agentEventStream } from '@/lib/websocket/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return new Response('Forbidden', { status: 403 });
  }

  return createAgentStreamResponse(request, (onEvent) => agentEventStream.subscribeAdmin(onEvent));
}
