/**
 * Real-time event system for cross-client synchronization.
 *
 * Transport is two-tier and degrades gracefully:
 *   1. Every event is delivered to subscribers in the CURRENT process
 *      synchronously via an in-memory bus. This covers the single-instance
 *      deploy and keeps working even if Redis is down.
 *   2. When `REDIS_URL` is configured, events are ALSO fanned out over Redis
 *      pub/sub so OTHER web instances (and processes that survive a restart)
 *      receive them. A per-process bridge (`ensureRealtimeBridge`) pumps those
 *      cross-instance events back into the in-memory bus, tagging each event
 *      with its origin process so the publisher never double-delivers.
 *
 * This mirrors the chat realtime transport in `@/lib/chat/realtime`. Publishers
 * call `publishEvent`; the SSE stream (`/api/events/stream`) subscribes to the
 * in-memory `eventBus` and calls `ensureRealtimeBridge()` once so cross-instance
 * events flow in.
 */

import { randomUUID } from 'crypto';
import { createRedisSubscriber, ensureRedisConnection, getRedisClient } from '@/lib/server/redis';

export type RealtimeEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.commented'
  | 'sprint.created'
  | 'sprint.updated'
  | 'sprint.deleted'
  | 'sprint.issues.changed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'member.added'
  | 'member.updated'
  | 'member.removed';

export interface RealtimeEvent {
  type: RealtimeEventType;
  projectId?: string;
  sprintId?: string;
  issueId?: string;
  organizationId?: string;
  userId: string; // who triggered the event
  timestamp: number;
}

type Listener = (event: RealtimeEvent) => void;

/** All realtime events share one channel; the SSE consumer filters by org
 *  membership + originating user before forwarding to a browser. */
const REALTIME_CHANNEL = 'tasknebula:realtime';

/** Identifies this Node process so the Redis bridge can skip events we
 *  published ourselves (already delivered to local subscribers synchronously). */
const PROCESS_ID = randomUUID();

class RealtimeEventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: RealtimeEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let one listener break others
      }
    }
  }

  get subscriberCount() {
    return this.listeners.size;
  }
}

// Singleton - shared across all API routes in the same process.
export const eventBus = new RealtimeEventBus();

// Helper to publish from API routes. Fire-and-forget: callers (the issue/sprint/
// project routes) do not await realtime delivery.
export function publishEvent(
  type: RealtimeEventType,
  userId: string,
  context?: Partial<Pick<RealtimeEvent, 'projectId' | 'sprintId' | 'issueId' | 'organizationId'>>
) {
  const event: RealtimeEvent = {
    type,
    userId,
    timestamp: Date.now(),
    ...(context ?? {}),
  };

  // 1) Deliver to subscribers in THIS process immediately. Resilient to Redis
  //    being unavailable and is the whole story for single-instance deploys.
  eventBus.publish(event);

  // 2) Fan out to OTHER instances via Redis (no-op when REDIS_URL is unset).
  void fanOutToRedis(event);
}

async function fanOutToRedis(event: RealtimeEvent): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    await ensureRedisConnection(client);
    await client.publish(REALTIME_CHANNEL, JSON.stringify({ origin: PROCESS_ID, event }));
  } catch (err) {
    // A Redis hiccup must never throw into a request handler / `after()` task.
    // Local subscribers already got the event via step 1 above.
    console.error('[realtime] redis fan-out failed', err);
  }
}

declare global {
  // eslint-disable-next-line no-var -- required for global augmentation
  var __tasknebulaRealtimeBridge__: Promise<void> | undefined;
}

/**
 * Start (once per process) the Redis→in-memory bridge that delivers events
 * published by OTHER instances to this process's subscribers. Safe to call on
 * every SSE connection — it is memoized on `globalThis` (survives dev hot
 * reload) and is a no-op when Redis is not configured. Never rejects.
 */
export function ensureRealtimeBridge(): Promise<void> {
  if (!global.__tasknebulaRealtimeBridge__) {
    global.__tasknebulaRealtimeBridge__ = startRealtimeBridge();
  }
  return global.__tasknebulaRealtimeBridge__;
}

async function startRealtimeBridge(): Promise<void> {
  try {
    const subscriber = await createRedisSubscriber();
    if (!subscriber) return; // No Redis → in-process bus is the only transport.

    await subscriber.subscribe(REALTIME_CHANNEL);
    subscriber.on('message', (channel: string, payload: string) => {
      if (channel !== REALTIME_CHANNEL) return;
      try {
        const parsed = JSON.parse(payload) as { origin?: string; event?: RealtimeEvent };
        if (!parsed.event) return;
        // Skip events we published — they were delivered locally already.
        if (parsed.origin === PROCESS_ID) return;
        eventBus.publish(parsed.event);
      } catch (err) {
        console.error('[realtime] failed to bridge event', err);
      }
    });
  } catch (err) {
    // Degrade to in-process delivery rather than crash the SSE route.
    console.error('[realtime] failed to start Redis bridge', err);
  }
}
