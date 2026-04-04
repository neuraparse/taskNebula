import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, touchConversationCallHeartbeat } from '@/lib/chat/server';

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
    const result = await touchConversationCallHeartbeat(roomId, session.user.id);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to pulse conversation call heartbeat:', error);
    return NextResponse.json({ error: 'Failed to pulse conversation call heartbeat' }, { status: 500 });
  }
}
