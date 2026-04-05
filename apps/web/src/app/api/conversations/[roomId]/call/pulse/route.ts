import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, touchConversationCallHeartbeat } from '@/lib/chat/server';
import { chatServerDebug, chatServerError } from '@/lib/chat/debug';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    const body = await request.json().catch(() => ({})) as {
      participantIdentity?: string;
    };
    chatServerDebug('route.call.pulse.request', {
      roomId,
      userId: session.user.id,
      participantIdentity: body.participantIdentity || null,
    });
    const result = await touchConversationCallHeartbeat(roomId, session.user.id, body.participantIdentity);
    chatServerDebug('route.call.pulse.success', {
      roomId,
      userId: session.user.id,
      result,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    chatServerError('route.call.pulse.error', {
      roomId: (await params).roomId,
      userId: session.user.id,
      error: error instanceof Error ? error : new Error('Failed to pulse conversation call heartbeat'),
    });
    return NextResponse.json({ error: 'Failed to pulse conversation call heartbeat' }, { status: 500 });
  }
}
