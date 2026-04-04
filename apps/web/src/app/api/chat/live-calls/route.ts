import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listAccessibleActiveCalls } from '@/lib/chat/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const calls = await listAccessibleActiveCalls(session.user.id);
    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Failed to load live calls:', error);
    return NextResponse.json({ error: 'Failed to load live calls' }, { status: 500 });
  }
}
