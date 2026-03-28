import { auth } from '@/auth';
import { eventBus, type RealtimeEvent } from '@/lib/realtime/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial keepalive
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Keepalive every 25 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 25000);

      // Subscribe to events
      const unsubscribe = eventBus.subscribe((event: RealtimeEvent) => {
        // Don't send events back to the user who triggered them
        if (event.userId === userId) return;

        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Connection closed
        }
      });

      // Cleanup on close - use a check interval since ReadableStream
      // doesn't have a native close event in all environments
      const checkClosed = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(''));
        } catch {
          clearInterval(keepalive);
          clearInterval(checkClosed);
          unsubscribe();
        }
      }, 30000);
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
