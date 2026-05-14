import { auth } from '@/auth';
import { eventBus, type RealtimeEvent } from '@/lib/realtime/events';

export const dynamic = 'force-dynamic';
// SSE keepalive: pure async iteration, no DB / fs / drizzle.
// Auth happens via JWT (next-auth) which is edge-safe.
// NOTE: kept on the Node runtime for now — `eventBus` is an in-process
// EventEmitter, and on edge the route would not see events from Node
// API routes. Once the bus is moved to Redis pub/sub we can flip this.
// export const runtime = 'edge';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
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
