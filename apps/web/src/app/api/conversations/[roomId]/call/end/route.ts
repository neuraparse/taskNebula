import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, endConversationCall } from '@/lib/chat/server';

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
    await endConversationCall(roomId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to end conversation call:', error);
    return NextResponse.json({ error: 'Failed to end conversation call' }, { status: 500 });
  }
}
