import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, moderateConversationMessages } from '@/lib/chat/server';

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
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action !== 'clear_deleted' && action !== 'clear_room') {
      return NextResponse.json({ error: 'Invalid moderation action' }, { status: 400 });
    }

    const result = await moderateConversationMessages({
      roomId,
      userId: session.user.id,
      action,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to moderate conversation messages:', error);
    return NextResponse.json({ error: 'Failed to moderate conversation messages' }, { status: 500 });
  }
}
