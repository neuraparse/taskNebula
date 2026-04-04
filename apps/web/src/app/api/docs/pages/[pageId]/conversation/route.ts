import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  buildConversationContext,
  ChatAccessError,
  ensureDocumentConversationRoom,
  getActiveCallSummary,
  listConversationMessages,
} from '@/lib/chat/server';
import { listRoomPresence } from '@/lib/chat/realtime';

async function getConversationPayload(userId: string, pageId: string) {
  const { room, page, context } = await ensureDocumentConversationRoom(userId, pageId);
  return {
    room,
    page,
    context: (await buildConversationContext(room.id))?.context || null,
    messages: await listConversationMessages(room.id, userId),
    presence: await listRoomPresence(room.id),
    activeCall: await getActiveCallSummary(room.id),
    effectiveSettings: context.effectiveSettings,
    permissions: context.permissions,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    return NextResponse.json(await getConversationPayload(session.user.id, pageId));
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load document conversation:', error);
    return NextResponse.json({ error: 'Failed to load document conversation' }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    return NextResponse.json(await getConversationPayload(session.user.id, pageId), { status: 201 });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to ensure document conversation:', error);
    return NextResponse.json({ error: 'Failed to ensure document conversation' }, { status: 500 });
  }
}
