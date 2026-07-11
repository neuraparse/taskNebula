import {
  disconnectWorkspaceIntegration,
  listWorkspaceIntegrationStatuses,
  requestWorkspaceIntegrationAuthorization,
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

describe('workspace integrations API', () => {
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

  it('lists and normalizes provider statuses from web integration routes', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          connected: true,
          connection: {
            id: 'conn_github',
            externalAccountId: '42',
            externalAccountLabel: 'octo-org',
            scope: 'repo read:user',
            metadata: { avatarUrl: 'https://example.com/avatar.png' },
            connectedById: 'user_1',
            createdAt: '2026-06-28T08:00:00.000Z',
            updatedAt: '2026-06-28T08:30:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { connected: false }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          connected: true,
          id: 'conn_jira',
          externalAccountId: 'site_1',
          externalAccountLabel: 'Platform Jira',
          scope: 'read:jira-work',
          siteUrl: 'https://tasks.atlassian.net',
          siteName: 'TaskNebula Jira',
          connectedAt: '2026-06-28T08:00:00.000Z',
          updatedAt: '2026-06-28T08:45:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { connected: false }))
      .mockResolvedValueOnce(jsonResponse(200, { connected: false }));

    await expect(listWorkspaceIntegrationStatuses('org_1')).resolves.toEqual([
      expect.objectContaining({
        provider: 'github',
        connected: true,
        connection: expect.objectContaining({
          id: 'conn_github',
          externalAccountLabel: 'octo-org',
          metadata: { avatarUrl: 'https://example.com/avatar.png' },
        }),
      }),
      expect.objectContaining({ provider: 'gitlab', connected: false, connection: null }),
      expect.objectContaining({
        provider: 'jira',
        connected: true,
        connection: expect.objectContaining({
          id: 'conn_jira',
          siteUrl: 'https://tasks.atlassian.net',
          siteName: 'TaskNebula Jira',
        }),
      }),
      expect.objectContaining({ provider: 'sentry', connected: false, connection: null }),
      expect.objectContaining({ provider: 'slack', connected: false, connection: null }),
    ]);

    expect(jest.mocked(globalThis.fetch).mock.calls.map(([url]) => url)).toEqual([
      'https://tasks.example.com/api/integrations/github/status?organizationId=org_1',
      'https://tasks.example.com/api/integrations/gitlab/status?organizationId=org_1',
      'https://tasks.example.com/api/integrations/jira?organizationId=org_1',
      'https://tasks.example.com/api/integrations/sentry/status?organizationId=org_1',
      'https://tasks.example.com/api/integrations/slack/status?organizationId=org_1',
    ]);
  });

  it('disconnects a provider through its web integration route', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(disconnectWorkspaceIntegration('org_1', 'jira')).resolves.toEqual({ ok: true });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://tasks.example.com/api/integrations/jira?organizationId=org_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('requests a native OAuth authorization URL', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        provider: 'github',
        authorizeUrl: 'https://github.com/login/oauth/authorize?state=tnm1.payload.sig',
      }),
    );

    await expect(requestWorkspaceIntegrationAuthorization('org_1', 'github')).resolves.toEqual({
      provider: 'github',
      authorizeUrl: 'https://github.com/login/oauth/authorize?state=tnm1.payload.sig',
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe(
      'https://tasks.example.com/api/integrations/mobile/authorize?organizationId=org_1&provider=github',
    );
  });
});
