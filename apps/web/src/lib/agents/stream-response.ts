import type { AgentStreamEvent } from '@/lib/websocket/server';

function serializeEvent(event: AgentStreamEvent) {
  return JSON.stringify(event);
}

export function createAgentStreamResponse(
  request: Request,
  subscribe: (onEvent: (event: AgentStreamEvent) => void) => () => void
) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const onAbort = () => {
        cleanup();
      };

      const keepalive = setInterval(() => {
        send(': ping\n\n');
      }, 25000);

      const unsubscribe = subscribe((event) => {
        send(`data: ${serializeEvent(event)}\n\n`);
      });

      cleanup = () => {
        if (closed) {
          return;
        }

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
      'X-Accel-Buffering': 'no',
    },
  });
}
