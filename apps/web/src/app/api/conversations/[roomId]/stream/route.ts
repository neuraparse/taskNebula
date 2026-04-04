import { auth } from '@/auth';
import { clearRoomPresence, listRoomPresence, subscribeToRoomEvents, touchRoomPresence } from '@/lib/chat/realtime';
import { ChatAccessError, getActiveCallSummary, resolveConversationRoomAccess } from '@/lib/chat/server';
import { createSseWriter } from '@/lib/chat/stream';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { roomId } = await params;
    const access = await resolveConversationRoomAccess(session.user.id, roomId);
    if (!access) {
      return new Response(JSON.stringify({ error: 'Conversation not found or unavailable' }), { status: 404 });
    }

    let eventCleanup: (() => Promise<void>) | null = null;
    let heartbeat: NodeJS.Timeout | null = null;
    let teardownStarted = false;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const writer = createSseWriter({
          enqueue: (payload) => controller.enqueue(encoder.encode(payload)),
          close: () => controller.close(),
        });

        const teardown = async () => {
          if (teardownStarted) {
            return;
          }

          teardownStarted = true;
          writer.close();

          if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
          }

          if (eventCleanup) {
            await eventCleanup();
            eventCleanup = null;
          }

          await clearRoomPresence(roomId, session.user.id!);
        };

        writer.send('connected', { roomId });

        await touchRoomPresence({
          roomId,
          userId: session.user.id!,
          name: session.user.name || null,
          image: session.user.image || null,
        });

        writer.send('presence', {
          roomId,
          participants: await listRoomPresence(roomId),
        });

        const activeCall = await getActiveCallSummary(roomId);
        if (activeCall) {
          writer.send('call.presence', { roomId, call: activeCall });
        }

        eventCleanup = await subscribeToRoomEvents(roomId, (event) => {
          writer.send(event.type, event.data);
        });

        heartbeat = setInterval(async () => {
          if (writer.isClosed()) {
            return;
          }

          try {
            await touchRoomPresence({
              roomId,
              userId: session.user.id!,
              name: session.user.name || null,
              image: session.user.image || null,
            });
            writer.send('heartbeat', { at: new Date().toISOString() });
          } catch (error) {
            console.error('Conversation stream heartbeat failed:', error);
          }
        }, 25000);

        request.signal.addEventListener('abort', () => {
          void teardown();
        });
      },
      async cancel() {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (eventCleanup) {
          await eventCleanup();
          eventCleanup = null;
        }
        await clearRoomPresence(roomId, session.user.id!);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status });
    }

    console.error('Failed to start conversation stream:', error);
    return new Response(JSON.stringify({ error: 'Failed to start conversation stream' }), { status: 500 });
  }
}
