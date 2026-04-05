import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, endConversationCall } from '@/lib/chat/server';
import { chatServerDebug, chatServerError } from '@/lib/chat/debug';

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
    chatServerDebug('route.call.end.request', {
      roomId,
      userId: session.user.id,
    });
    await endConversationCall(roomId, session.user.id);
    chatServerDebug('route.call.end.success', {
      roomId,
      userId: session.user.id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    chatServerError('route.call.end.error', {
      roomId: (await params).roomId,
      userId: session.user.id,
      error: error instanceof Error ? error : new Error('Failed to end conversation call'),
    });
    return NextResponse.json({ error: 'Failed to end conversation call' }, { status: 500 });
  }
}
