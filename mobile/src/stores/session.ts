/**
 * Session store — the single source of truth for "which server am I on and am
 * I signed in". Orchestrates the API client config + SecureStore persistence.
 *
 *   status: loading → (no-server | setup-required | unauthenticated | authenticated)
 *
 * Secrets (server URL + session cookie) live in SecureStore, keyed per server
 * so multiple self-hosted instances never share a cookie.
 */
import i18next from 'i18next';
import { create } from 'zustand';
import { configureApi, normalizeBaseUrl, setUnauthorizedHandler } from '@/api/client';
import {
  checkSetup,
  createInitialSetup,
  exchangeMobileOAuthToken,
  exchangeSamlToken,
  fetchMe,
  login,
  logout,
  type InitialSetupInput,
  type InitialSetupResult,
} from '@/api/auth';
import { config } from '@/config/env';
import { clearMobileQueryCache } from '@/lib/query';
import { isSameBaseUrl } from '@/lib/server-url';
import { deleteSecure, getSecure, mmkv, setSecure } from '@/lib/storage';
import type { User } from '@/api/types';

type Status = 'loading' | 'no-server' | 'setup-required' | 'unauthenticated' | 'authenticated';

const K_SERVER = 'server_url';
const cookieKey = (server: string) => `session_cookie::${server}`;
const userKey = (server: string) => `user::${server}`;

function cacheUser(serverUrl: string, user: User): void {
  const serialized = JSON.stringify(user);
  mmkv.set(userKey(serverUrl), serialized);
  mmkv.set('user', serialized);
}

function clearCachedUser(serverUrl?: string | null): void {
  if (serverUrl) mmkv.remove(userKey(serverUrl));
  mmkv.remove('user');
}

async function unauthenticatedStatusForServer(
  serverUrl: string,
): Promise<'setup-required' | 'unauthenticated'> {
  const setup = await checkSetup(serverUrl);
  if (!setup.databaseReady) throw new Error(i18next.t('setup.databaseNotReady'));
  return setup.setupRequired ? 'setup-required' : 'unauthenticated';
}

async function restoreStoredSession(
  serverUrl: string,
  signedOutStatus: 'setup-required' | 'unauthenticated',
  setState: (state: Partial<SessionState>) => void,
  options: { allowLegacyUserCache?: boolean } = {},
): Promise<boolean> {
  const cookie = await getSecure(cookieKey(serverUrl));
  if (!cookie) {
    clearMobileQueryCache();
    configureApi({ cookie: null });
    clearCachedUser(serverUrl);
    setState({ status: signedOutStatus, user: null });
    return false;
  }

  if (signedOutStatus === 'setup-required') {
    await deleteSecure(cookieKey(serverUrl));
    clearMobileQueryCache();
    configureApi({ cookie: null });
    clearCachedUser(serverUrl);
    setState({ status: signedOutStatus, user: null });
    return false;
  }

  configureApi({ cookie });

  const cached =
    mmkv.getString(userKey(serverUrl)) ??
    (options.allowLegacyUserCache ? mmkv.getString('user') : null);
  if (cached) {
    try {
      setState({ user: JSON.parse(cached) as User, status: 'authenticated' });
    } catch {
      clearCachedUser(serverUrl);
    }
  }

  try {
    const user = await fetchMe(cookie);
    cacheUser(serverUrl, user);
    setState({ user, status: 'authenticated' });
    return true;
  } catch {
    await deleteSecure(cookieKey(serverUrl));
    clearMobileQueryCache();
    configureApi({ cookie: null });
    clearCachedUser(serverUrl);
    setState({ status: signedOutStatus, user: null });
    return false;
  }
}

interface SessionState {
  status: Status;
  serverUrl: string | null;
  user: User | null;
  hydrate: () => Promise<void>;
  connectServer: (url: string) => Promise<void>;
  completeSetup: (input: InitialSetupInput) => Promise<InitialSetupResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithMobileOAuthToken: (token: string) => Promise<void>;
  signInWithSamlToken: (token: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  forgetServer: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  serverUrl: null,
  user: null,

  hydrate: async () => {
    setUnauthorizedHandler(() => {
      void get().signOut();
    });

    const storedServerUrl = await getSecure(K_SERVER);
    if (!storedServerUrl) {
      const defaultServerUrl = normalizeBaseUrl(config.apiBaseUrl);
      if (defaultServerUrl) {
        try {
          await get().connectServer(defaultServerUrl);
          return;
        } catch {
          configureApi({ baseUrl: null, cookie: null });
        }
      }
      clearMobileQueryCache();
      set({ status: 'no-server', serverUrl: null });
      return;
    }
    const serverUrl = storedServerUrl;
    configureApi({ baseUrl: serverUrl, cookie: null });
    set({ serverUrl });

    let signedOutStatus: 'setup-required' | 'unauthenticated' = 'unauthenticated';
    try {
      signedOutStatus = await unauthenticatedStatusForServer(serverUrl);
    } catch {
      signedOutStatus = 'unauthenticated';
    }

    await restoreStoredSession(serverUrl, signedOutStatus, set, { allowLegacyUserCache: true });
  },

  connectServer: async (url: string) => {
    const normalized = normalizeBaseUrl(url);
    if (!normalized) throw new Error(i18next.t('errors.enterServerUrl'));
    if (isSameBaseUrl(normalized, get().serverUrl)) {
      configureApi({ baseUrl: normalized });
      if (get().status !== 'authenticated') {
        const status = await unauthenticatedStatusForServer(normalized);
        await restoreStoredSession(normalized, status, (state) =>
          set({ serverUrl: normalized, ...state }),
        );
      }
      return;
    }
    const previousServerUrl = get().serverUrl;
    const status = await unauthenticatedStatusForServer(normalized);
    await setSecure(K_SERVER, normalized);
    configureApi({ baseUrl: normalized, cookie: null });
    clearCachedUser(previousServerUrl);
    set({ serverUrl: normalized, status: 'loading', user: null });
    await restoreStoredSession(normalized, status, (state) =>
      set({ serverUrl: normalized, ...state }),
    );
  },

  completeSetup: async (input: InitialSetupInput) => {
    const { serverUrl } = get();
    if (!serverUrl) throw new Error(i18next.t('errors.noServerConfigured'));
    const result = await createInitialSetup(input);
    try {
      await get().signIn(input.email.trim().toLowerCase(), input.password);
    } catch (error) {
      set({ status: 'unauthenticated', user: null });
      throw error;
    }
    return result;
  },

  signIn: async (email: string, password: string) => {
    const { serverUrl } = get();
    if (!serverUrl) throw new Error(i18next.t('errors.noServerConfigured'));
    const { cookie, user } = await login(email, password);
    clearMobileQueryCache();
    await setSecure(cookieKey(serverUrl), cookie);
    configureApi({ cookie });
    cacheUser(serverUrl, user);
    set({ user, status: 'authenticated' });
  },

  signInWithMobileOAuthToken: async (token: string) => {
    const { serverUrl } = get();
    if (!serverUrl) throw new Error(i18next.t('errors.noServerConfigured'));
    const { cookie, user } = await exchangeMobileOAuthToken(token);
    clearMobileQueryCache();
    await setSecure(cookieKey(serverUrl), cookie);
    configureApi({ cookie });
    cacheUser(serverUrl, user);
    set({ user, status: 'authenticated' });
  },

  signInWithSamlToken: async (token: string) => {
    const { serverUrl } = get();
    if (!serverUrl) throw new Error(i18next.t('errors.noServerConfigured'));
    const { cookie, user } = await exchangeSamlToken(token);
    clearMobileQueryCache();
    await setSecure(cookieKey(serverUrl), cookie);
    configureApi({ cookie });
    cacheUser(serverUrl, user);
    set({ user, status: 'authenticated' });
  },

  refreshUser: async () => {
    const { serverUrl } = get();
    if (!serverUrl) throw new Error(i18next.t('errors.noServerConfigured'));
    const cookie = await getSecure(cookieKey(serverUrl));
    if (!cookie) throw new Error(i18next.t('errors.sessionExpired'));
    const user = await fetchMe(cookie);
    cacheUser(serverUrl, user);
    set({ user, status: 'authenticated' });
  },

  signOut: async () => {
    const { serverUrl } = get();
    const cookie = serverUrl ? await getSecure(cookieKey(serverUrl)) : null;
    await logout(cookie);
    if (serverUrl) await deleteSecure(cookieKey(serverUrl));
    clearMobileQueryCache();
    configureApi({ cookie: null });
    clearCachedUser(serverUrl);
    set({ status: 'unauthenticated', user: null });
  },

  forgetServer: async () => {
    await get().signOut();
    await deleteSecure(K_SERVER);
    configureApi({ baseUrl: null, cookie: null });
    set({ status: 'no-server', serverUrl: null, user: null });
  },
}));
