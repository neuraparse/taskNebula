import Redis from 'ioredis';

declare global {
  var __tasknebulaRedis__: Redis | undefined;
}

function getRedisUrl() {
  return process.env.REDIS_URL || null;
}

export function isRedisConfigured() {
  return Boolean(getRedisUrl());
}

export function getRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  if (!global.__tasknebulaRedis__) {
    global.__tasknebulaRedis__ = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
  }

  return global.__tasknebulaRedis__;
}

export async function createRedisSubscriber() {
  const baseClient = getRedisClient();
  if (!baseClient) {
    return null;
  }

  const subscriber = baseClient.duplicate({
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
  });
  await subscriber.connect();
  return subscriber;
}

export async function ensureRedisConnection(client: Redis | null) {
  if (!client) {
    return null;
  }

  if (client.status === 'wait') {
    await client.connect();
  }

  return client;
}
