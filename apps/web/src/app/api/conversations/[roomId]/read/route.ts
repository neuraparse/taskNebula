import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, markConversationRead, resolveConversationRoomAccess } from '@/lib/chat/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    const access = await resolveConversationRoomAccess(session.user.id, roomId);
    if (!access) {
      return NextResponse.json({ error: 'Conversation not found or unavailable' }, { status: 404 });
    }

    const payload = await request.json().catch(() => ({}));
    await markConversationRead(roomId, session.user.id, payload.lastReadMessageId || null);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to mark conversation as read:', error);
    return NextResponse.json({ error: 'Failed to mark conversation as read' }, { status: 500 });
  }
}
