import {
  checkSetup,
  createInitialSetup,
  exchangeMobileOAuthToken,
  exchangeSamlToken,
  getLoginOAuthAvailability,
  getServerHealth,
  mobileOAuthAuthorizeUrl,
  mobileSamlAuthorizeUrl,
  refreshEmailVerification,
  verifyEmail,
} from './auth';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown, setCookie?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((name: string) =>
        name.toLowerCase() === 'set-cookie' ? (setCookie ?? null) : null,
      ),
    },
  } as unknown as Response;
}

describe('setup API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: null, cookie: null });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('detects a fresh self-hosted instance that requires setup', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { setupRequired: true }));

    await expect(checkSetup('https://tasks.example.com')).resolves.toEqual({
      setupRequired: true,
      databaseReady: true,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('https://tasks.example.com/api/setup', {
      headers: { Accept: 'application/json' },
    });
  });

  it('keeps database-not-ready setup responses distinct from login failures', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(503, { setupRequired: false, databaseReady: false }));

    await expect(checkSetup('https://tasks.example.com')).resolves.toEqual({
      setupRequired: false,
      databaseReady: false,
    });
  });

  it('loads unhealthy server health responses from the configured instance', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(503, {
        status: 'unhealthy',
        version: '0.7.11',
        uptime: 42,
        checks: { database: 'error', memory: 'ok' },
      }),
    );

    await expect(getServerHealth()).resolves.toEqual({
      status: 'unhealthy',
      version: '0.7.11',
      uptime: 42,
      checks: { database: 'error', memory: 'ok' },
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('https://tasks.example.com/api/health', {
      headers: { Accept: 'application/json' },
    });
  });

  it('creates the initial admin with the blank self-host setup mode', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(201, {
        success: true,
        nextPath: '/dashboard',
        user: { id: 'user_1', name: 'Ada', email: 'ada@example.com' },
      }),
    );

    await createInitialSetup({
      name: 'Ada',
      email: 'ADA@EXAMPLE.COM',
      password: 'password123',
      organizationName: ' TaskNebula Labs ',
    });

    const [, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      organizationName: 'TaskNebula Labs',
      startMode: 'blank',
    });
  });

  it('creates an initial import target project during self-host setup', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(201, {
        success: true,
        startMode: 'import',
        nextPath: '/settings/import?source=plane&projectId=project_1',
        import: { source: 'plane', projectId: 'project_1', projectKey: 'MB' },
        user: { id: 'user_1', name: 'Ada', email: 'ada@example.com' },
      }),
    );

    await expect(
      createInitialSetup({
        name: 'Ada',
        email: 'ADA@EXAMPLE.COM',
        password: 'password123',
        organizationName: ' TaskNebula Labs ',
        startMode: 'import',
        importSource: 'plane',
        importProjectName: ' Migration backlog ',
        importProjectKey: ' mb ',
      }),
    ).resolves.toMatchObject({
      startMode: 'import',
      import: { source: 'plane', projectId: 'project_1', projectKey: 'MB' },
    });

    const [, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      organizationName: 'TaskNebula Labs',
      startMode: 'import',
      importSource: 'plane',
      importProjectName: 'Migration backlog',
      importProjectKey: 'MB',
    });
  });

  it('verifies email tokens through the self-hosted JSON endpoint', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(200, { verified: true, authenticated: false }));

    await expect(verifyEmail(' verify-token ')).resolves.toEqual({
      verified: true,
      authenticated: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://tasks.example.com/api/auth/verify-email/verify-token',
      {
        headers: { Accept: 'application/json' },
      },
    );
  });

  it('surfaces email verification reason codes for invalid tokens', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(400, { verified: false, reason: 'expired' }));

    await expect(verifyEmail('expired-token')).rejects.toMatchObject({
      status: 400,
      message: 'expired',
    });
  });

  it('refreshes authenticated email verification state', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=s1' });
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { verified: true }));

    await expect(refreshEmailVerification()).resolves.toEqual({ verified: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://tasks.example.com/api/auth/verify-email/refresh',
      {
        method: 'POST',
        headers: { Accept: 'application/json', Cookie: 'authjs.session-token=s1' },
      },
    );
  });

  it('lists configured login OAuth providers from the self-hosted server', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(200, { providers: { github: true, google: false } }));

    await expect(getLoginOAuthAvailability()).resolves.toEqual({
      github: true,
      google: false,
    });
    expect(mobileOAuthAuthorizeUrl('github')).toBe(
      'https://tasks.example.com/api/auth/mobile/oauth/authorize?provider=github',
    );
    expect(mobileOAuthAuthorizeUrl('google', '/settings/sso')).toBe(
      'https://tasks.example.com/api/auth/mobile/oauth/authorize?provider=google&callbackUrl=%2Fsettings%2Fsso',
    );
  });

  it('exchanges a mobile OAuth token for an Auth.js session cookie', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, { csrfToken: 'csrf-1' }, 'authjs.csrf-token=csrf-1; Path=/'),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          { url: 'https://tasks.example.com/dashboard' },
          'authjs.session-token=session-1; Path=/',
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'user_1',
          email: 'user@example.com',
          name: 'User',
          image: null,
        }),
      );

    await expect(exchangeMobileOAuthToken(' exchange-token ')).resolves.toEqual({
      cookie: 'authjs.csrf-token=csrf-1; authjs.session-token=session-1',
      user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User',
        image: null,
      },
    });

    const [, exchangeInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(String(exchangeInit?.body)).toContain('token=exchange-token');
    expect(exchangeInit).toMatchObject({
      method: 'POST',
      redirect: 'manual',
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[1]).toMatchObject({
      headers: {
        Accept: 'application/json',
        Cookie: 'authjs.csrf-token=csrf-1; authjs.session-token=session-1',
      },
    });
  });

  it('exchanges a SAML bridge token for an Auth.js session cookie', async () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: null });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, { csrfToken: 'csrf-1' }, 'authjs.csrf-token=csrf-1; Path=/'),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          { url: 'https://tasks.example.com/dashboard' },
          'authjs.session-token=session-1; Path=/',
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'user_1',
          email: 'user@example.com',
          name: 'User',
          image: null,
        }),
      );

    await expect(exchangeSamlToken(' saml-token ')).resolves.toMatchObject({
      cookie: 'authjs.csrf-token=csrf-1; authjs.session-token=session-1',
      user: { id: 'user_1', email: 'user@example.com' },
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/auth/callback/saml-bridge',
    );
    expect(mobileSamlAuthorizeUrl(' acme ')).toBe(
      'https://tasks.example.com/api/auth/saml/acme/init?mobile=1',
    );
    expect(mobileSamlAuthorizeUrl(' acme ', '/projects/TN/chat')).toBe(
      'https://tasks.example.com/api/auth/saml/acme/init?mobile=1&callbackUrl=%2Fprojects%2FTN%2Fchat',
    );
  });
});
