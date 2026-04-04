import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, startConversationCall } from '@/lib/chat/server';
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
    const call = await startConversationCall(roomId, session.user.id);
    return NextResponse.json({
      call,
      livekit: getLivekitStatus(),
    });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to start conversation call:', error);
    return NextResponse.json({ error: 'Failed to start conversation call' }, { status: 500 });
  }
}
