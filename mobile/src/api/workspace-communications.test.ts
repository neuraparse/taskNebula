import {
  getWorkspaceCommunicationsSettings,
  updateWorkspaceCommunicationsSettings,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('workspace communications API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads and normalizes workspace communications settings', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        organizationId: 'org_1',
        organizationName: 'TaskNebula Labs',
        settings: {
          enabled: true,
          voiceEnabled: false,
          issueThreadsEnabled: true,
        },
        serviceStatus: {
          redisReady: true,
          livekit: {
            ready: false,
            url: null,
            missing: ['LIVEKIT_API_KEY'],
          },
        },
      }),
    );

    await expect(getWorkspaceCommunicationsSettings('org_1')).resolves.toEqual({
      organizationId: 'org_1',
      organizationName: 'TaskNebula Labs',
      settings: {
        enabled: true,
        voiceEnabled: false,
        issueThreadsEnabled: true,
        documentThreadsEnabled: true,
        attachmentsEnabled: true,
        unreadTrackingEnabled: true,
      },
      serviceStatus: {
        redisReady: true,
        livekit: {
          ready: false,
          url: null,
          missing: ['LIVEKIT_API_KEY'],
        },
      },
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/organizations/org_1/communications',
    );
  });

  it('patches only the requested toggle fields', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        organizationId: 'org_1',
        settings: {
          enabled: false,
          voiceEnabled: true,
          issueThreadsEnabled: true,
          documentThreadsEnabled: true,
          attachmentsEnabled: true,
          unreadTrackingEnabled: true,
        },
      }),
    );

    await expect(
      updateWorkspaceCommunicationsSettings({
        organizationId: 'org_1',
        enabled: false,
      }),
    ).resolves.toMatchObject({
      organizationId: 'org_1',
      settings: {
        enabled: false,
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/organizations/org_1/communications');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({ enabled: false });
  });
});
