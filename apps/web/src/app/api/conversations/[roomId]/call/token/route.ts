import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, createConversationCallToken } from '@/lib/chat/server';
import { chatServerDebug, chatServerError } from '@/lib/chat/debug';
import { resolveLivekitPublicUrl } from '@/lib/chat/livekit';

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
      clientSessionId?: string;
    };
    chatServerDebug('route.call.token.request', {
      roomId,
      userId: session.user.id,
      clientSessionId: body.clientSessionId || null,
      host: request.headers.get('host'),
      forwardedHost: request.headers.get('x-forwarded-host'),
      publicUrl: resolveLivekitPublicUrl(request),
    });
    const token = await createConversationCallToken(roomId, session.user.id, {
      publicUrlOverride: resolveLivekitPublicUrl(request),
      clientSessionId: body.clientSessionId,
    });
    chatServerDebug('route.call.token.success', {
      roomId,
      userId: session.user.id,
      participantIdentity: token.participantIdentity,
      roomName: token.roomName,
      url: token.url,
    });
    return NextResponse.json(token);
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    chatServerError('route.call.token.error', {
      roomId: (await params).roomId,
      userId: session.user.id,
      error: error instanceof Error ? error : new Error('Failed to create call token'),
    });
    return NextResponse.json({ error: 'Failed to create call token' }, { status: 500 });
  }
}
