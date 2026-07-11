import {
  createApiKey,
  createWebhook,
  listApiKeys,
  listAuditLogs,
  listWebhooks,
  revokeApiKey,
  testWebhook,
  updateWebhook,
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

describe('developer settings API', () => {
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

  it('lists and normalizes organization API keys', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        apiKeys: [
          {
            id: 'key_1',
            name: 'CI',
            keyPrefix: 'sk_live_1234',
            isActive: true,
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
            createdAt: '2026-06-28T08:00:00.000Z',
          },
          { id: 'missing-name' },
        ],
      }),
    );

    await expect(listApiKeys('org_1')).resolves.toEqual([
      {
        id: 'key_1',
        name: 'CI',
        keyPrefix: 'sk_live_1234',
        isActive: true,
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: '2026-06-28T08:00:00.000Z',
      },
    ]);

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/api-keys?organizationId=org_1');
  });

  it('creates and revokes API keys against the web routes', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          apiKey: {
            id: 'key_1',
            name: 'Mobile CI',
            keyPrefix: 'sk_live_abcd',
            key: 'sk_live_abcd-secret',
            isActive: true,
            lastUsedAt: null,
            expiresAt: '2026-09-26T08:00:00.000Z',
            revokedAt: null,
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { message: 'ok' }));

    await expect(
      createApiKey({
        organizationId: 'org_1',
        name: 'Mobile CI',
        expiresAt: '2026-09-26T08:00:00.000Z',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'key_1',
        key: 'sk_live_abcd-secret',
        expiresAt: '2026-09-26T08:00:00.000Z',
      }),
    );

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: 'Mobile CI',
      organizationId: 'org_1',
      expiresAt: '2026-09-26T08:00:00.000Z',
    });

    await revokeApiKey('key_1');
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://tasks.example.com/api/api-keys/key_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('manages organization webhooks with create, patch, list, and test routes', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          webhooks: [
            {
              id: 'wh_1',
              name: 'Automation',
              url: 'https://ci.example.com/tasknebula',
              events: ['issue.created'],
              isActive: true,
              successCount: '4',
              failureCount: '1',
              lastTriggeredAt: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          webhook: {
            id: 'wh_2',
            name: 'Deploy',
            url: 'https://ci.example.com/deploy',
            events: ['issue.updated'],
            isActive: true,
            successCount: 0,
            failureCount: 0,
            lastTriggeredAt: null,
            secret: 'secret-once',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'wh_2',
          name: 'Deploy',
          url: 'https://ci.example.com/deploy',
          events: ['issue.updated'],
          isActive: false,
          successCount: 0,
          failureCount: 0,
          lastTriggeredAt: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          statusCode: 204,
          durationMs: '42',
        }),
      );

    await expect(listWebhooks({ organizationId: 'org_1' })).resolves.toEqual([
      expect.objectContaining({
        id: 'wh_1',
        successCount: 4,
        failureCount: 1,
      }),
    ]);

    await expect(
      createWebhook({
        organizationId: 'org_1',
        name: 'Deploy',
        url: 'https://ci.example.com/deploy',
        events: ['issue.updated'],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'wh_2', secret: 'secret-once' }));

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: 'Deploy',
      url: 'https://ci.example.com/deploy',
      organizationId: 'org_1',
      events: ['issue.updated'],
    });

    await expect(updateWebhook({ id: 'wh_2', isActive: false })).resolves.toEqual(
      expect.objectContaining({ id: 'wh_2', isActive: false }),
    );

    await expect(testWebhook('wh_2')).resolves.toEqual({
      success: true,
      statusCode: 204,
      durationMs: 42,
    });
  });

  it('lists organization audit logs for workspace managers', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        auditLogs: [
          {
            id: 'audit_1',
            action: 'api_key.revoked',
            resourceType: 'api_key',
            resourceId: 'key_1',
            projectId: null,
            issueId: null,
            changes: { isActive: { from: true, to: false } },
            metadata: { source: 'mobile' },
            createdAt: '2026-06-28T08:00:00.000Z',
            user: {
              id: 'user_1',
              name: 'Ada',
              email: 'ada@example.com',
              image: null,
            },
          },
          { id: 'missing-action' },
        ],
      }),
    );

    await expect(listAuditLogs({ organizationId: 'org_1', limit: 75 })).resolves.toEqual([
      expect.objectContaining({
        id: 'audit_1',
        action: 'api_key.revoked',
        resourceType: 'api_key',
        resourceId: 'key_1',
        changes: { isActive: { from: true, to: false } },
        metadata: { source: 'mobile' },
        user: expect.objectContaining({ id: 'user_1', email: 'ada@example.com' }),
      }),
    ]);

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/audit-logs?organizationId=org_1&limit=75');
  });
});
