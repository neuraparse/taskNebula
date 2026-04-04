import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, createConversationCallToken } from '@/lib/chat/server';
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
    const token = await createConversationCallToken(roomId, session.user.id, {
      publicUrlOverride: resolveLivekitPublicUrl(request),
    });
    return NextResponse.json(token);
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create call token:', error);
    return NextResponse.json({ error: 'Failed to create call token' }, { status: 500 });
  }
}
