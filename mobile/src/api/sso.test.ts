import { configureApi } from './client';
import {
  createScimToken,
  deleteSsoConfig,
  getSsoConfig,
  listScimTokens,
  revokeScimToken,
  upsertSsoConfig,
} from './endpoints';

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

describe('SSO API', () => {
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

  it('loads and normalizes SAML config', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        ssoConfig: {
          id: 'sso_1',
          workspaceId: 'org_1',
          provider: 'saml',
          entryPointUrl: 'https://idp.example.com/sso',
          issuer: 'https://idp.example.com',
          cert: 'CERT',
          audience: 'https://tasks.example.com/api/auth/saml/acme/metadata.xml',
          attributeMap: { email: 'mail', bad: 42 },
          enabled: true,
          hasPrivateKey: false,
          createdAt: '2026-06-28T08:00:00.000Z',
          updatedAt: '2026-06-28T09:00:00.000Z',
        },
      }),
    );

    await expect(getSsoConfig('org_1')).resolves.toEqual({
      ssoConfig: {
        id: 'sso_1',
        workspaceId: 'org_1',
        provider: 'saml',
        entryPointUrl: 'https://idp.example.com/sso',
        issuer: 'https://idp.example.com',
        cert: 'CERT',
        audience: 'https://tasks.example.com/api/auth/saml/acme/metadata.xml',
        attributeMap: { email: 'mail' },
        enabled: true,
        hasPrivateKey: false,
        createdAt: '2026-06-28T08:00:00.000Z',
        updatedAt: '2026-06-28T09:00:00.000Z',
      },
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/sso/configs?organizationId=org_1',
    );
  });

  it('upserts and deletes SAML config', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(
      upsertSsoConfig({
        organizationId: 'org_1',
        entryPointUrl: 'https://idp.example.com/sso',
        issuer: 'https://idp.example.com',
        cert: 'CERT',
        audience: 'https://tasks.example.com/api/auth/saml/acme/metadata.xml',
        attributeMap: { email: 'mail' },
        enabled: true,
      }),
    ).resolves.toEqual({ ok: true });

    const [upsertUrl, upsertInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(upsertUrl).toBe('https://tasks.example.com/api/sso/configs');
    expect(upsertInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(upsertInit?.body))).toEqual({
      organizationId: 'org_1',
      provider: 'saml',
      entryPointUrl: 'https://idp.example.com/sso',
      issuer: 'https://idp.example.com',
      cert: 'CERT',
      audience: 'https://tasks.example.com/api/auth/saml/acme/metadata.xml',
      attributeMap: { email: 'mail' },
      enabled: true,
    });

    await expect(deleteSsoConfig('org_1')).resolves.toEqual({ ok: true });
    const [deleteUrl, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(deleteUrl).toBe('https://tasks.example.com/api/sso/configs?organizationId=org_1');
    expect(deleteInit).toMatchObject({ method: 'DELETE' });
  });

  it('lists, creates, and revokes SCIM tokens', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tokens: [
            {
              id: 'tok_1',
              name: 'Okta',
              createdAt: '2026-06-28T08:00:00.000Z',
              lastUsedAt: null,
              revokedAt: null,
            },
            { id: 'bad' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 'tok_2',
          name: 'Entra ID',
          token: 'tn_scim_secret',
          createdAt: '2026-06-28T09:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(listScimTokens('org_1')).resolves.toEqual({
      tokens: [
        {
          id: 'tok_1',
          name: 'Okta',
          createdAt: '2026-06-28T08:00:00.000Z',
          lastUsedAt: null,
          revokedAt: null,
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/sso/tokens?organizationId=org_1',
    );

    await expect(createScimToken({ organizationId: 'org_1', name: 'Entra ID' })).resolves.toEqual({
      id: 'tok_2',
      name: 'Entra ID',
      token: 'tn_scim_secret',
      createdAt: '2026-06-28T09:00:00.000Z',
    });
    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      organizationId: 'org_1',
      name: 'Entra ID',
    });

    await expect(revokeScimToken('tok_2')).resolves.toEqual({ ok: true });
    const [revokeUrl, revokeInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    expect(revokeUrl).toBe('https://tasks.example.com/api/sso/tokens/tok_2');
    expect(revokeInit).toMatchObject({ method: 'DELETE' });
  });
});
