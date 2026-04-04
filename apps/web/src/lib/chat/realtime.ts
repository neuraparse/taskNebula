import { EventEmitter } from 'events';
import type Redis from 'ioredis';
import { createRedisSubscriber, ensureRedisConnection, getRedisClient } from '@/lib/server/redis';

type ChatRealtimeEvent = {
  type: string;
  data: Record<string, unknown>;
};

declare global {
  var __tasknebulaChatEmitter__: EventEmitter | undefined;
}

function getFallbackEmitter() {
  if (!global.__tasknebulaChatEmitter__) {
    global.__tasknebulaChatEmitter__ = new EventEmitter();
  }

  return global.__tasknebulaChatEmitter__;
}

export function getRoomChannel(roomId: string) {
  return `chat:room:${roomId}`;
}

export async function publishRoomEvent(roomId: string, event: ChatRealtimeEvent) {
  const channel = getRoomChannel(roomId);
  const client = await ensureRedisConnection(getRedisClient());

  if (client) {
    await client.publish(channel, JSON.stringify(event));
    return;
  }

  getFallbackEmitter().emit(channel, event);
}

export async function subscribeToRoomEvents(
  roomId: string,
  onEvent: (event: ChatRealtimeEvent) => void
) {
  const channel = getRoomChannel(roomId);
  const subscriber = await createRedisSubscriber();

  if (subscriber) {
    await subscriber.subscribe(channel);
    const handler = (_channel: string, payload: string) => {
      if (_channel !== channel) {
        return;
      }

      try {
        onEvent(JSON.parse(payload) as ChatRealtimeEvent);
      } catch (error) {
        console.error('Failed to parse room event payload:', error);
      }
    };

    subscriber.on('message', handler);

    return async () => {
      subscriber.off('message', handler);
      try {
        await subscriber.unsubscribe(channel);
      } finally {
        await subscriber.quit();
      }
    };
  }

  const emitter = getFallbackEmitter();
  const handler = (event: ChatRealtimeEvent) => {
    onEvent(event);
  };
  emitter.on(channel, handler);

  return async () => {
    emitter.off(channel, handler);
  };
}

type PresenceEntry = {
  roomId: string;
  userId: string;
  name: string | null;
  image: string | null;
  lastSeenAt: string;
};

declare global {
  var __tasknebulaRoomPresence__: Map<string, PresenceEntry> | undefined;
}

function getPresenceStore() {
  if (!global.__tasknebulaRoomPresence__) {
    global.__tasknebulaRoomPresence__ = new Map<string, PresenceEntry>();
  }

  return global.__tasknebulaRoomPresence__;
}

function getPresenceKey(roomId: string, userId: string) {
  return `chat:presence:${roomId}:${userId}`;
}

function getPresenceRedisPattern(roomId: string) {
  return `chat:presence:${roomId}:*`;
}

export async function touchRoomPresence(params: {
  roomId: string;
  userId: string;
  name: string | null;
  image: string | null;
}) {
  const entry: PresenceEntry = {
    roomId: params.roomId,
    userId: params.userId,
    name: params.name,
    image: params.image,
    lastSeenAt: new Date().toISOString(),
  };
  const client = await ensureRedisConnection(getRedisClient());

  if (client) {
    await client.set(
      getPresenceKey(params.roomId, params.userId),
      JSON.stringify(entry),
      'EX',
      70
    );
  } else {
    getPresenceStore().set(getPresenceKey(params.roomId, params.userId), entry);
  }

  await publishRoomEvent(params.roomId, {
    type: 'presence',
    data: {
      roomId: params.roomId,
      participants: await listRoomPresence(params.roomId),
    },
  });
}

export async function clearRoomPresence(roomId: string, userId: string) {
  const client = await ensureRedisConnection(getRedisClient());
  if (client) {
    await client.del(getPresenceKey(roomId, userId));
  } else {
    getPresenceStore().delete(getPresenceKey(roomId, userId));
  }

  await publishRoomEvent(roomId, {
    type: 'presence',
    data: {
      roomId,
      participants: await listRoomPresence(roomId),
    },
  });
}

export async function listRoomPresence(roomId: string) {
  const client = await ensureRedisConnection(getRedisClient());
  const now = Date.now();

  if (client) {
    const keys = await client.keys(getPresenceRedisPattern(roomId));
    if (keys.length === 0) {
      return [];
    }

    const values = await client.mget(...keys);
    return values
      .flatMap((value) => {
        if (!value) {
          return [];
        }

        try {
          return [JSON.parse(value) as PresenceEntry];
        } catch {
          return [];
        }
      })
      .filter((entry) => now - new Date(entry.lastSeenAt).getTime() < 75000)
      .sort((left, right) => left.name?.localeCompare(right.name || '') || 0);
  }

  const entries = [...getPresenceStore().values()]
    .filter((entry) => entry.roomId === roomId)
    .filter((entry) => now - new Date(entry.lastSeenAt).getTime() < 75000);

  return entries.sort((left, right) => left.name?.localeCompare(right.name || '') || 0);
}
