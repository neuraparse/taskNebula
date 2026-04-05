import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, leaveConversationCall } from '@/lib/chat/server';
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
    chatServerDebug('route.call.leave.request', {
      roomId,
      userId: session.user.id,
      participantIdentity: body.participantIdentity || null,
    });
    const call = await leaveConversationCall(roomId, session.user.id, body.participantIdentity);
    chatServerDebug('route.call.leave.success', {
      roomId,
      userId: session.user.id,
      remainingCallId: call?.id || null,
      participantCount: call?.participantCount || 0,
    });
    return NextResponse.json({ success: true, call });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    chatServerError('route.call.leave.error', {
      roomId: (await params).roomId,
      userId: session.user.id,
      error: error instanceof Error ? error : new Error('Failed to leave conversation call'),
    });
    return NextResponse.json({ error: 'Failed to leave conversation call' }, { status: 500 });
  }
}
