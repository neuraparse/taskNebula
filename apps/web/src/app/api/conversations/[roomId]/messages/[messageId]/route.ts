import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ChatAccessError,
  deleteConversationMessage,
  updateConversationMessage,
} from '@/lib/chat/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId, messageId } = await params;
    const body = await request.json();
    const message = await updateConversationMessage({
      roomId,
      messageId,
      userId: session.user.id,
      body: body.body,
      reactionEmoji: body.reactionEmoji,
    });

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update conversation message:', error);
    return NextResponse.json({ error: 'Failed to update conversation message' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId, messageId } = await params;
    const message = await deleteConversationMessage({
      roomId,
      messageId,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete conversation message:', error);
    return NextResponse.json({ error: 'Failed to delete conversation message' }, { status: 500 });
  }
}
