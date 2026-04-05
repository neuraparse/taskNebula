import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, startConversationCall } from '@/lib/chat/server';
import { chatServerDebug, chatServerError } from '@/lib/chat/debug';
import { getLivekitStatus } from '@/lib/chat/livekit';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    chatServerDebug('route.call.start.request', {
      roomId,
      userId: session.user.id,
    });
    const call = await startConversationCall(roomId, session.user.id);
    chatServerDebug('route.call.start.success', {
      roomId,
      userId: session.user.id,
      callId: call?.id || null,
      participantCount: call?.participantCount || 0,
    });
    return NextResponse.json({
      call,
      livekit: getLivekitStatus(),
    });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    chatServerError('route.call.start.error', {
      roomId: (await params).roomId,
      userId: session.user.id,
      error: error instanceof Error ? error : new Error('Failed to start conversation call'),
    });
    return NextResponse.json({ error: 'Failed to start conversation call' }, { status: 500 });
  }
}
