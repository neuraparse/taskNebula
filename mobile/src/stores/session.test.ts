const mockSecureStore = new Map<string, string>();
const mockMmkvStore = new Map<string, string>();
const mockCheckSetup = jest.fn();
const mockFetchMe = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockCreateInitialSetup = jest.fn();
const mockExchangeMobileOAuthToken = jest.fn();
const mockExchangeSamlToken = jest.fn();
const mockConfigureApi = jest.fn();
const mockSetUnauthorizedHandler = jest.fn();
const mockClearMobileQueryCache = jest.fn();
let mockApiBaseUrl: string | null = null;

jest.mock('@/lib/storage', () => ({
  setSecure: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  getSecure: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  deleteSecure: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
  mmkv: {
    getString: jest.fn((key: string) => mockMmkvStore.get(key)),
    set: jest.fn((key: string, value: string) => {
      mockMmkvStore.set(key, value);
    }),
    remove: jest.fn((key: string) => {
      mockMmkvStore.delete(key);
    }),
  },
}));

jest.mock('@/api/auth', () => ({
  checkSetup: (...args: unknown[]) => mockCheckSetup(...args),
  createInitialSetup: (...args: unknown[]) => mockCreateInitialSetup(...args),
  exchangeMobileOAuthToken: (...args: unknown[]) => mockExchangeMobileOAuthToken(...args),
  exchangeSamlToken: (...args: unknown[]) => mockExchangeSamlToken(...args),
  fetchMe: (...args: unknown[]) => mockFetchMe(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
}));

jest.mock('@/api/client', () => ({
  configureApi: (...args: unknown[]) => mockConfigureApi(...args),
  normalizeBaseUrl: (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
  },
  setUnauthorizedHandler: (...args: unknown[]) => mockSetUnauthorizedHandler(...args),
}));

jest.mock('@/config/env', () => ({
  config: {
    appVersion: '0.0.0-test',
    get apiBaseUrl() {
      return mockApiBaseUrl;
    },
  },
}));

jest.mock('@/lib/query', () => ({
  clearMobileQueryCache: (...args: unknown[]) => mockClearMobileQueryCache(...args),
}));

import { useSession } from './session';
import type { User } from '@/api/types';

const oldUser: User = {
  id: 'old_user',
  email: 'old@example.com',
  name: 'Old User',
  image: null,
};

const newUser: User = {
  id: 'new_user',
  email: 'new@example.com',
  name: 'New User',
  image: null,
};

describe('session store', () => {
  beforeEach(() => {
    mockSecureStore.clear();
    mockMmkvStore.clear();
    jest.clearAllMocks();
    mockApiBaseUrl = null;
    useSession.setState({
      status: 'loading',
      serverUrl: null,
      user: null,
    });
  });

  it('uses a configured default self-hosted server when no server has been saved', async () => {
    mockApiBaseUrl = 'http://10.0.2.2:3000/';
    mockCheckSetup.mockResolvedValue({ setupRequired: false, databaseReady: true });

    await useSession.getState().hydrate();

    expect(mockCheckSetup).toHaveBeenCalledWith('http://10.0.2.2:3000');
    expect(mockSecureStore.get('server_url')).toBe('http://10.0.2.2:3000');
    expect(mockConfigureApi).toHaveBeenCalledWith({
      baseUrl: 'http://10.0.2.2:3000',
      cookie: null,
    });
    expect(useSession.getState()).toMatchObject({
      status: 'unauthenticated',
      serverUrl: 'http://10.0.2.2:3000',
      user: null,
    });
  });

  it('keeps the saved self-hosted server ahead of the configured default', async () => {
    mockApiBaseUrl = 'https://default.example.com';
    mockCheckSetup.mockResolvedValue({ setupRequired: false, databaseReady: true });
    mockSecureStore.set('server_url', 'https://saved.example.com');

    await useSession.getState().hydrate();

    expect(mockCheckSetup).toHaveBeenCalledWith('https://saved.example.com');
    expect(mockCheckSetup).not.toHaveBeenCalledWith('https://default.example.com');
    expect(useSession.getState()).toMatchObject({
      status: 'unauthenticated',
      serverUrl: 'https://saved.example.com',
      user: null,
    });
  });

  it('falls back to manual server setup when the configured default is unreachable', async () => {
    mockApiBaseUrl = 'https://offline.example.com';
    mockCheckSetup.mockRejectedValue(new Error('unreachable'));

    await useSession.getState().hydrate();

    expect(mockCheckSetup).toHaveBeenCalledWith('https://offline.example.com');
    expect(mockSecureStore.get('server_url')).toBeUndefined();
    expect(mockConfigureApi).toHaveBeenLastCalledWith({ baseUrl: null, cookie: null });
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(useSession.getState()).toMatchObject({
      status: 'no-server',
      serverUrl: null,
      user: null,
    });
  });

  it('restores the saved session cookie when switching to a known self-hosted server', async () => {
    mockCheckSetup.mockResolvedValue({ setupRequired: false, databaseReady: true });
    mockFetchMe.mockResolvedValue(newUser);
    mockSecureStore.set(
      'session_cookie::https://new.example.com',
      'authjs.session-token=new-session',
    );
    useSession.setState({
      status: 'authenticated',
      serverUrl: 'https://old.example.com',
      user: oldUser,
    });

    await useSession.getState().connectServer('https://new.example.com');

    expect(mockCheckSetup).toHaveBeenCalledWith('https://new.example.com');
    expect(mockFetchMe).toHaveBeenCalledWith('authjs.session-token=new-session');
    expect(mockSecureStore.get('server_url')).toBe('https://new.example.com');
    expect(useSession.getState()).toMatchObject({
      status: 'authenticated',
      serverUrl: 'https://new.example.com',
      user: newUser,
    });
    expect(JSON.parse(mockMmkvStore.get('user::https://new.example.com') ?? '{}')).toEqual(newUser);
    expect(JSON.parse(mockMmkvStore.get('user') ?? '{}')).toEqual(newUser);
  });

  it('clears the previous user cache when switching to a server without a saved session', async () => {
    mockCheckSetup.mockResolvedValue({ setupRequired: false, databaseReady: true });
    mockMmkvStore.set('user::https://old.example.com', JSON.stringify(oldUser));
    mockMmkvStore.set('user', JSON.stringify(oldUser));
    useSession.setState({
      status: 'authenticated',
      serverUrl: 'https://old.example.com',
      user: oldUser,
    });

    await useSession.getState().connectServer('https://fresh.example.com');

    expect(mockFetchMe).not.toHaveBeenCalled();
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(useSession.getState()).toMatchObject({
      status: 'unauthenticated',
      serverUrl: 'https://fresh.example.com',
      user: null,
    });
    expect(mockMmkvStore.get('user::https://old.example.com')).toBeUndefined();
    expect(mockMmkvStore.get('user')).toBeUndefined();
  });

  it('deletes an expired saved session for the target server', async () => {
    mockCheckSetup.mockResolvedValue({ setupRequired: false, databaseReady: true });
    mockFetchMe.mockRejectedValue(new Error('expired'));
    mockSecureStore.set(
      'session_cookie::https://new.example.com',
      'authjs.session-token=expired-session',
    );

    await useSession.getState().connectServer('https://new.example.com');

    expect(mockFetchMe).toHaveBeenCalledWith('authjs.session-token=expired-session');
    expect(mockSecureStore.get('session_cookie::https://new.example.com')).toBeUndefined();
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(useSession.getState()).toMatchObject({
      status: 'unauthenticated',
      serverUrl: 'https://new.example.com',
      user: null,
    });
  });

  it('refreshes the authenticated user from the active self-hosted server', async () => {
    const refreshedUser = { ...newUser, emailVerificationRequired: false };
    mockFetchMe.mockResolvedValue(refreshedUser);
    mockSecureStore.set(
      'session_cookie::https://tasks.example.com',
      'authjs.session-token=session-1',
    );
    useSession.setState({
      status: 'authenticated',
      serverUrl: 'https://tasks.example.com',
      user: { ...newUser, emailVerificationRequired: true },
    });

    await useSession.getState().refreshUser();

    expect(mockFetchMe).toHaveBeenCalledWith('authjs.session-token=session-1');
    expect(useSession.getState()).toMatchObject({
      status: 'authenticated',
      user: refreshedUser,
    });
    expect(mockClearMobileQueryCache).not.toHaveBeenCalled();
    expect(JSON.parse(mockMmkvStore.get('user::https://tasks.example.com') ?? '{}')).toEqual(
      refreshedUser,
    );
  });

  it('clears protected query cache before storing a credential sign-in session', async () => {
    mockLogin.mockResolvedValue({
      cookie: 'authjs.session-token=credential-session',
      user: newUser,
    });
    useSession.setState({
      status: 'unauthenticated',
      serverUrl: 'https://tasks.example.com',
      user: null,
    });

    await useSession.getState().signIn('USER@EXAMPLE.COM', 'password123');

    expect(mockLogin).toHaveBeenCalledWith('USER@EXAMPLE.COM', 'password123');
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(mockSecureStore.get('session_cookie::https://tasks.example.com')).toBe(
      'authjs.session-token=credential-session',
    );
    expect(useSession.getState()).toMatchObject({
      status: 'authenticated',
      serverUrl: 'https://tasks.example.com',
      user: newUser,
    });
  });

  it('persists a mobile OAuth exchange session on the active self-hosted server', async () => {
    mockExchangeMobileOAuthToken.mockResolvedValue({
      cookie: 'authjs.session-token=oauth-session',
      user: newUser,
    });
    useSession.setState({
      status: 'unauthenticated',
      serverUrl: 'https://tasks.example.com',
      user: null,
    });

    await useSession.getState().signInWithMobileOAuthToken('exchange-token');

    expect(mockExchangeMobileOAuthToken).toHaveBeenCalledWith('exchange-token');
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(mockSecureStore.get('session_cookie::https://tasks.example.com')).toBe(
      'authjs.session-token=oauth-session',
    );
    expect(mockConfigureApi).toHaveBeenLastCalledWith({
      cookie: 'authjs.session-token=oauth-session',
    });
    expect(JSON.parse(mockMmkvStore.get('user::https://tasks.example.com') ?? '{}')).toEqual(
      newUser,
    );
    expect(useSession.getState()).toMatchObject({
      status: 'authenticated',
      serverUrl: 'https://tasks.example.com',
      user: newUser,
    });
  });

  it('persists a SAML bridge exchange session separately per self-hosted server', async () => {
    mockExchangeSamlToken.mockResolvedValue({
      cookie: 'authjs.session-token=saml-session',
      user: newUser,
    });
    mockSecureStore.set(
      'session_cookie::https://old.example.com',
      'authjs.session-token=old-session',
    );
    useSession.setState({
      status: 'unauthenticated',
      serverUrl: 'https://tasks.example.com',
      user: null,
    });

    await useSession.getState().signInWithSamlToken('saml-token');

    expect(mockExchangeSamlToken).toHaveBeenCalledWith('saml-token');
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(mockSecureStore.get('session_cookie::https://tasks.example.com')).toBe(
      'authjs.session-token=saml-session',
    );
    expect(mockSecureStore.get('session_cookie::https://old.example.com')).toBe(
      'authjs.session-token=old-session',
    );
    expect(useSession.getState()).toMatchObject({
      status: 'authenticated',
      serverUrl: 'https://tasks.example.com',
      user: newUser,
    });
  });

  it('completes first-run setup and signs in to the configured self-hosted server', async () => {
    mockCreateInitialSetup.mockResolvedValue({
      success: true,
      startMode: 'import',
      import: { source: 'jira', projectId: 'project_1', projectKey: 'MOB' },
    });
    mockLogin.mockResolvedValue({
      cookie: 'authjs.session-token=setup-session',
      user: newUser,
    });
    useSession.setState({
      status: 'setup-required',
      serverUrl: 'https://fresh.example.com',
      user: null,
    });

    await expect(
      useSession.getState().completeSetup({
        name: 'Ada Lovelace',
        email: 'ADA@EXAMPLE.COM',
        password: 'password123',
        organizationName: 'Mobile Lab',
        startMode: 'import',
        importSource: 'jira',
        importProjectName: 'Mobile backlog',
        importProjectKey: 'mob',
      }),
    ).resolves.toEqual({
      success: true,
      startMode: 'import',
      import: { source: 'jira', projectId: 'project_1', projectKey: 'MOB' },
    });

    expect(mockCreateInitialSetup).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      email: 'ADA@EXAMPLE.COM',
      password: 'password123',
      organizationName: 'Mobile Lab',
      startMode: 'import',
      importSource: 'jira',
      importProjectName: 'Mobile backlog',
      importProjectKey: 'mob',
    });
    expect(mockLogin).toHaveBeenCalledWith('ada@example.com', 'password123');
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(mockSecureStore.get('session_cookie::https://fresh.example.com')).toBe(
      'authjs.session-token=setup-session',
    );
    expect(useSession.getState()).toMatchObject({
      status: 'authenticated',
      serverUrl: 'https://fresh.example.com',
      user: newUser,
    });
  });

  it('clears protected query cache when signing out from a self-hosted server', async () => {
    mockLogout.mockResolvedValue({ success: true });
    mockSecureStore.set(
      'session_cookie::https://tasks.example.com',
      'authjs.session-token=session-1',
    );
    mockMmkvStore.set('user::https://tasks.example.com', JSON.stringify(newUser));
    useSession.setState({
      status: 'authenticated',
      serverUrl: 'https://tasks.example.com',
      user: newUser,
    });

    await useSession.getState().signOut();

    expect(mockLogout).toHaveBeenCalledWith('authjs.session-token=session-1');
    expect(mockSecureStore.get('session_cookie::https://tasks.example.com')).toBeUndefined();
    expect(mockClearMobileQueryCache).toHaveBeenCalledTimes(1);
    expect(mockMmkvStore.get('user::https://tasks.example.com')).toBeUndefined();
    expect(useSession.getState()).toMatchObject({
      status: 'unauthenticated',
      serverUrl: 'https://tasks.example.com',
      user: null,
    });
  });
});
