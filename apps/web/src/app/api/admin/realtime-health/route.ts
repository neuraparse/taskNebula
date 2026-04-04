import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  conversationRooms,
  db,
  projectChannels,
  roomReadStates,
} from '@tasknebula/db';
import { count } from 'drizzle-orm';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { countResolvedActiveCalls } from '@/lib/chat/server';
import { getLivekitStatus } from '@/lib/chat/livekit';
import { isRedisConfigured } from '@/lib/server/redis';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const [[channelCount], [roomCount], activeCallCount, [readStateCount]] = await Promise.all([
      db.select({ count: count() }).from(projectChannels),
      db.select({ count: count() }).from(conversationRooms),
      countResolvedActiveCalls(),
      db.select({ count: count() }).from(roomReadStates),
    ]);

    return NextResponse.json({
      services: {
        redis: {
          ready: isRedisConfigured(),
          mode: isRedisConfigured() ? 'redis_pubsub' : 'in_memory_fallback',
        },
        livekit: getLivekitStatus(),
      },
      stats: {
        channels: Number(channelCount?.count || 0),
        rooms: Number(roomCount?.count || 0),
        activeCalls: Number(activeCallCount || 0),
        readStates: Number(readStateCount?.count || 0),
      },
    });
  } catch (error) {
    console.error('Failed to load realtime health:', error);
    return NextResponse.json({ error: 'Failed to load realtime health' }, { status: 500 });
  }
}
