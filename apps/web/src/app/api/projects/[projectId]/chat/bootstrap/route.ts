import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ChatAccessError, getProjectChatBootstrap } from '@/lib/chat/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await params;
    const bootstrap = await getProjectChatBootstrap(session.user.id, projectId);
    return NextResponse.json(bootstrap);
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load chat bootstrap:', error);
    return NextResponse.json({ error: 'Failed to load chat bootstrap' }, { status: 500 });
  }
}
