import { createSseWriter, serializeConversationEvent } from '@/lib/chat/stream';

describe('chat stream helpers', () => {
  it('serializes server-sent events consistently', () => {
    expect(serializeConversationEvent('connected', { roomId: 'room-1' })).toBe(
      'data: {"type":"connected","data":{"roomId":"room-1"}}\n\n'
    );
  });

  it('stops writing after the controller is closed', () => {
    const enqueue = jest
      .fn()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new TypeError('Invalid state: Controller is already closed');
      });
    const close = jest.fn();

    const writer = createSseWriter({ enqueue, close });

    expect(writer.send('connected', { roomId: 'room-1' })).toBe(true);
    expect(writer.send('heartbeat', { at: 'now' })).toBe(false);
    expect(writer.isClosed()).toBe(true);

    writer.close();
    writer.close();

    expect(close).not.toHaveBeenCalled();
  });

  it('closes only once when the stream is still open', () => {
    const close = jest.fn();
    const writer = createSseWriter({
      enqueue: jest.fn(),
      close,
    });

    writer.close();
    writer.close();

    expect(writer.isClosed()).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
