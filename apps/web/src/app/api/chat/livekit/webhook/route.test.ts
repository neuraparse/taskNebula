const receiveMock = jest.fn();
const handleLivekitWebhookEventMock = jest.fn();

jest.mock('livekit-server-sdk', () => ({
  WebhookReceiver: jest.fn().mockImplementation(() => ({
    receive: receiveMock,
  })),
}));

jest.mock('@/lib/chat/server', () => ({
  handleLivekitWebhookEvent: (...args: unknown[]) => handleLivekitWebhookEventMock(...args),
}));

describe('POST /api/chat/livekit/webhook', () => {
  const originalEnv = process.env;
  let POST: typeof import('./route').POST;
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      LIVEKIT_API_KEY: 'tasknebula-dev',
      LIVEKIT_API_SECRET: 'tasknebula-secret',
    };
  });

  beforeAll(async () => {
    if (typeof global.Request === 'undefined') {
      class MockHeaders {
        private readonly values: Map<string, string>;

        constructor(init?: Record<string, string>) {
          this.values = new Map(
            Object.entries(init || {}).map(([key, value]) => [key.toLowerCase(), value])
          );
        }

        get(key: string) {
          return this.values.get(key.toLowerCase()) ?? null;
        }
      }

      class MockRequest {
        url: string;
        method: string;
        headers: MockHeaders;
        private readonly bodyValue: string;

        constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
          this.url = url;
          this.method = init?.method || 'GET';
          this.headers = new MockHeaders(init?.headers);
          this.bodyValue = init?.body || '';
        }

        async text() {
          return this.bodyValue;
        }
      }

      class MockResponse {
        status: number;
        headers: MockHeaders;
        private readonly bodyValue: string;

        constructor(body?: string, init?: { status?: number; headers?: Record<string, string> }) {
          this.status = init?.status || 200;
          this.headers = new MockHeaders(init?.headers);
          this.bodyValue = body || '';
        }

        async json() {
          return JSON.parse(this.bodyValue || '{}');
        }

        async text() {
          return this.bodyValue;
        }

        static json(value: unknown, init?: { status?: number; headers?: Record<string, string> }) {
          return new MockResponse(JSON.stringify(value), {
            status: init?.status,
            headers: {
              'content-type': 'application/json',
              ...(init?.headers || {}),
            },
          });
        }
      }

      Object.assign(global, {
        Headers: MockHeaders,
        Request: MockRequest,
        Response: MockResponse,
      });
    }

    ({ POST } = await import('./route'));
  });

  afterAll(() => {
    process.env = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it('verifies and forwards participant departure events', async () => {
    receiveMock.mockResolvedValue({
      event: 'participant_left',
      room: { name: 'tn-web-room-1' },
      participant: { identity: 'user-1' },
    });
    handleLivekitWebhookEventMock.mockResolvedValue({
      handled: true,
      reason: 'participant_left',
    });

    const request = new Request('http://localhost:3002/api/chat/livekit/webhook', {
      method: 'POST',
      headers: {
        authorization: 'Bearer signed-webhook',
        'content-type': 'application/webhook+json',
      },
      body: JSON.stringify({ hello: 'world' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(receiveMock).toHaveBeenCalledWith(JSON.stringify({ hello: 'world' }), 'Bearer signed-webhook');
    expect(handleLivekitWebhookEventMock).toHaveBeenCalledWith({
      event: 'participant_left',
      roomName: 'tn-web-room-1',
      participantIdentity: 'user-1',
    });
  });

  it('returns 401 for invalid webhook signatures', async () => {
    receiveMock.mockRejectedValue(new Error('sha256 checksum of body does not match'));

    const request = new Request('http://localhost:3002/api/chat/livekit/webhook', {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid',
      },
      body: '{}',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(handleLivekitWebhookEventMock).not.toHaveBeenCalled();
  });
});
