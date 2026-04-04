export function serializeConversationEvent(type: string, data: Record<string, unknown>) {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

function isClosedControllerError(error: unknown) {
  return error instanceof TypeError && error.message.toLowerCase().includes('controller is already closed');
}

export function createSseWriter(options: {
  enqueue: (payload: string) => void;
  close: () => void;
}) {
  let closed = false;

  return {
    send(type: string, data: Record<string, unknown>) {
      if (closed) {
        return false;
      }

      try {
        options.enqueue(serializeConversationEvent(type, data));
        return true;
      } catch (error) {
        if (isClosedControllerError(error)) {
          closed = true;
          return false;
        }

        throw error;
      }
    },
    close() {
      if (closed) {
        return;
      }

      closed = true;

      try {
        options.close();
      } catch (error) {
        if (!isClosedControllerError(error)) {
          throw error;
        }
      }
    },
    isClosed() {
      return closed;
    },
  };
}
