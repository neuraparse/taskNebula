import { auth } from '@/auth';
import { db, organizationMembers, users } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { eventBus, ensureRealtimeBridge, type RealtimeEvent } from '@/lib/realtime/events';

export const dynamic = 'force-dynamic';
// SSE stream: one membership snapshot query at connect, then pure async
// iteration. Auth happens via JWT (next-auth).
// NOTE: kept on the Node runtime — we subscribe to the in-process `eventBus`
// and query Drizzle at connect time; on edge the route would see neither.
// `ensureRealtimeBridge()` pumps events published by OTHER instances (via Redis
// pub/sub) into that in-process bus, so this stays correct across replicas.
// export const runtime = 'edge';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  // Tenant isolation: snapshot the subscriber's active org memberships at
  // connect time and only forward events for those organizations.
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const memberships = isSuperAdmin
    ? []
    : await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(
          and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active'))
        );
  const memberOrgIds = new Set(memberships.map((m) => m.organizationId));

  // Ensure cross-instance events (published over Redis by other web replicas)
  // are bridged into this process's in-memory bus. No-op without REDIS_URL.
  await ensureRealtimeBridge();

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const onAbort = () => {
        cleanup();
      };

      // Keepalive every 25 seconds
      const keepalive = setInterval(() => {
        send(': ping\n\n');
      }, 25000);

      // Subscribe to events
      const unsubscribe = eventBus.subscribe((event: RealtimeEvent) => {
        // Don't send events back to the user who triggered them
        if (event.userId === userId) return;
        // Tenant isolation: only forward events that provably belong to one
        // of the subscriber's organizations. Events without an
        // organizationId are dropped (fail closed) — publishers must attach
        // organizationId for the event to be delivered.
        if (
          event.targetUserId !== userId &&
          !isSuperAdmin &&
          (!event.organizationId || !memberOrgIds.has(event.organizationId))
        ) {
          return;
        }
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unsubscribe();
        request.signal.removeEventListener('abort', onAbort);
        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      };

      request.signal.addEventListener('abort', onAbort);

      // Send initial keepalive
      send(': connected\n\n');
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
