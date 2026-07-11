/**
 * Auth flow against a self-hosted TaskNebula (NextAuth v5, cookie sessions).
 *
 * Login is the browser "CSRF dance" replicated for a native client:
 *   1. GET  /api/auth/csrf                  → { csrfToken } + Set-Cookie csrf
 *   2. POST /api/auth/callback/credentials  (form-encoded, with csrf cookie)
 *                                           → Set-Cookie session token
 *   3. replay the merged cookie jar on every API call.
 *
 * No web-side changes are required for this to work.
 */
import i18next from 'i18next';
import { ApiError, extractCookies, getAuthCookie, getBaseUrl, mergeCookies } from './client';
import type { HealthResponse, User } from './types';

// NextAuth cookie names vary by HTTPS (__Secure- prefix) / chunking — match generically.
const AUTH_COOKIE = /^(__Secure-|__Host-)?authjs\.(session-token|csrf-token)(\.\d+)?$/;

function rawUrl(path: string, targetBaseUrl: string | null = getBaseUrl()): string {
  const base = targetBaseUrl;
  if (!base) throw new ApiError(0, i18next.t('errors.noServerConfigured'));
  return `${base}${path}`;
}

/** Probe an arbitrary base URL during onboarding (before the client is set). */
export async function probeServer(baseUrl: string): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: { Accept: 'application/json' },
  });
  // /api/health returns 200 when healthy, 503 when unhealthy — both are valid
  // "this is a TaskNebula server" signals. Anything else means wrong URL.
  if (res.status !== 200 && res.status !== 503) {
    throw new ApiError(res.status, i18next.t('errors.notTaskNebulaServer', { status: res.status }));
  }
  const data = (await res.json().catch(() => ({}))) as HealthResponse;
  if (!data || typeof data.status !== 'string') {
    throw new ApiError(res.status, i18next.t('errors.unexpectedServerResponse'));
  }
  return data;
}

export async function getServerHealth(): Promise<HealthResponse> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new ApiError(0, i18next.t('errors.noServerConfigured'));
  return probeServer(baseUrl);
}

export interface LoginResult {
  cookie: string;
  user: User;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
  projectInviteToken?: string;
}

export interface SignupResult {
  message?: string;
  user?: User;
  projectInvite?: {
    projectKey?: string;
  };
}

export interface SetupStatus {
  setupRequired: boolean;
  databaseReady: boolean;
}

export interface InitialSetupInput {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
  startMode?: 'blank' | 'import';
  importSource?: 'csv' | 'plane' | 'linear' | 'jira' | 'github';
  importProjectName?: string;
  importProjectKey?: string;
}

export interface InitialSetupResult {
  success?: boolean;
  message?: string;
  nextPath?: string;
  startMode?: 'blank' | 'import';
  import?: {
    source?: 'csv' | 'plane' | 'linear' | 'jira' | 'github';
    projectId?: string;
    projectKey?: string;
  } | null;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface VerifyEmailResult {
  verified: boolean;
  authenticated?: boolean;
  reason?: 'invalid' | 'expired' | 'already_used' | 'user_missing' | 'server_error' | string;
}

export type LoginOAuthProvider = 'github' | 'google';

export interface LoginOAuthAvailability {
  github: boolean;
  google: boolean;
}

type AuthBridgeProvider = 'mobile-oauth' | 'saml-bridge';

export async function checkSetup(baseUrl?: string): Promise<SetupStatus> {
  const res = await fetch(rawUrl('/api/setup', baseUrl ?? getBaseUrl()), {
    headers: { Accept: 'application/json' },
  });

  const payload = (await res.json().catch(() => ({}))) as {
    setupRequired?: boolean;
    databaseReady?: boolean;
    error?: string;
  };

  if (res.status === 503 && payload.databaseReady === false) {
    return { setupRequired: false, databaseReady: false };
  }

  if (!res.ok) {
    throw new ApiError(res.status, i18next.t('setup.connectionError'));
  }

  return {
    setupRequired: payload.setupRequired === true,
    databaseReady: payload.databaseReady !== false,
  };
}

export async function createInitialSetup(input: InitialSetupInput): Promise<InitialSetupResult> {
  const organizationName = input.organizationName?.trim();
  const startMode = input.startMode === 'import' ? 'import' : 'blank';
  const importProjectName = input.importProjectName?.trim();
  const importProjectKey = input.importProjectKey?.trim().toUpperCase();
  const res = await fetch(rawUrl('/api/setup'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      startMode,
      ...(organizationName ? { organizationName } : {}),
      ...(startMode === 'import'
        ? {
            importSource: input.importSource,
            importProjectName,
            importProjectKey,
          }
        : {}),
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as InitialSetupResult & {
    error?: string;
  };

  if (!res.ok) {
    throw new ApiError(res.status, payload.error ?? i18next.t('setup.failed'));
  }

  return payload;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // 1) CSRF token + cookie
  const csrfRes = await fetch(rawUrl('/api/auth/csrf'), {
    headers: { Accept: 'application/json' },
  });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  let jar = extractCookies(csrfRes.headers.get('set-cookie'), AUTH_COOKIE);

  // 2) Credentials callback (form-encoded). X-Auth-Return-Redirect → JSON, no HTML 302.
  const body = new URLSearchParams({ csrfToken, email, password, json: 'true' }).toString();
  const loginRequest: RequestInit & { redirect?: 'manual' } = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'X-Auth-Return-Redirect': '1',
      ...(jar ? { Cookie: jar } : {}),
    },
    body,
    redirect: 'manual',
  };
  const loginRes = await fetch(rawUrl('/api/auth/callback/credentials'), loginRequest);
  const loginPayload = (await loginRes.json().catch(() => null)) as { url?: string } | null;

  jar = mergeCookies(jar, extractCookies(loginRes.headers.get('set-cookie'), AUTH_COOKIE));

  if (!/authjs\.session-token/.test(jar)) {
    // NextAuth returns 200 with ?error=CredentialsSignin on bad creds.
    if (typeof loginPayload?.url === 'string' && loginPayload.url.includes('error=MissingCSRF')) {
      throw new ApiError(0, i18next.t('errors.authCookiesRejected'));
    }
    throw new ApiError(401, i18next.t('errors.invalidCredentials'));
  }

  // 3) Confirm the session and load the user with the new jar.
  const user = await fetchMe(jar);
  return { cookie: jar, user };
}

async function exchangeAuthBridgeToken(
  token: string,
  provider: AuthBridgeProvider,
): Promise<LoginResult> {
  const cleanToken = token.trim();
  if (!cleanToken) throw new ApiError(401, i18next.t('errors.invalidCredentials'));

  const csrfRes = await fetch(rawUrl('/api/auth/csrf'), {
    headers: { Accept: 'application/json' },
  });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  let jar = extractCookies(csrfRes.headers.get('set-cookie'), AUTH_COOKIE);

  const body = new URLSearchParams({
    csrfToken,
    token: cleanToken,
    json: 'true',
  }).toString();
  const exchangeRequest: RequestInit & { redirect?: 'manual' } = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'X-Auth-Return-Redirect': '1',
      ...(jar ? { Cookie: jar } : {}),
    },
    body,
    redirect: 'manual',
  };
  const exchangeRes = await fetch(rawUrl(`/api/auth/callback/${provider}`), exchangeRequest);
  const exchangePayload = (await exchangeRes.json().catch(() => null)) as { url?: string } | null;
  jar = mergeCookies(jar, extractCookies(exchangeRes.headers.get('set-cookie'), AUTH_COOKIE));

  if (!/authjs\.session-token/.test(jar)) {
    if (
      typeof exchangePayload?.url === 'string' &&
      exchangePayload.url.includes('error=CredentialsSignin')
    ) {
      throw new ApiError(401, i18next.t('errors.invalidCredentials'));
    }
    throw new ApiError(401, i18next.t('errors.invalidCredentials'));
  }

  const user = await fetchMe(jar);
  return { cookie: jar, user };
}

export async function exchangeMobileOAuthToken(token: string): Promise<LoginResult> {
  return exchangeAuthBridgeToken(token, 'mobile-oauth');
}

export async function exchangeSamlToken(token: string): Promise<LoginResult> {
  return exchangeAuthBridgeToken(token, 'saml-bridge');
}

export async function getLoginOAuthAvailability(): Promise<LoginOAuthAvailability> {
  const res = await fetch(rawUrl('/api/auth/oauth-providers'), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return { github: false, google: false };

  const payload = (await res.json().catch(() => ({}))) as {
    providers?: Partial<LoginOAuthAvailability>;
  };

  return {
    github: payload.providers?.github === true,
    google: payload.providers?.google === true,
  };
}

export function mobileOAuthAuthorizeUrl(
  provider: LoginOAuthProvider,
  callbackUrl?: string | null,
): string {
  const params = new URLSearchParams({ provider });
  if (callbackUrl) params.set('callbackUrl', callbackUrl);
  return rawUrl(`/api/auth/mobile/oauth/authorize?${params.toString()}`);
}

export function mobileSamlAuthorizeUrl(workspaceSlug: string, callbackUrl?: string | null): string {
  const params = new URLSearchParams({ mobile: '1' });
  if (callbackUrl) params.set('callbackUrl', callbackUrl);
  return rawUrl(`/api/auth/saml/${encodeURIComponent(workspaceSlug.trim())}/init?${params}`);
}

export async function signup(input: SignupInput): Promise<SignupResult> {
  const res = await fetch(rawUrl('/api/auth/signup'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      email: input.email.trim().toLowerCase(),
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as SignupResult & {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload.code ?? payload.error ?? i18next.t('errors.signupFailed'),
    );
  }

  return payload;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(rawUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, payload.error ?? i18next.t('errors.passwordResetFailed'));
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(rawUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token.trim(), newPassword }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, payload.error ?? i18next.t('errors.passwordResetFailed'));
  }
}

export async function requestEmailVerification(email: string): Promise<void> {
  const res = await fetch(rawUrl('/api/auth/send-verification'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, payload.error ?? i18next.t('errors.verificationEmailFailed'));
  }
}

export async function refreshEmailVerification(): Promise<Pick<VerifyEmailResult, 'verified'>> {
  const authCookie = getAuthCookie();
  const res = await fetch(rawUrl('/api/auth/verify-email/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(authCookie ? { Cookie: authCookie } : {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as Pick<VerifyEmailResult, 'verified'> & {
    error?: string;
  };
  if (!res.ok) {
    throw new ApiError(res.status, payload.error ?? i18next.t('errors.verificationEmailFailed'));
  }
  return { verified: payload.verified === true };
}

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const cleanToken = token.trim();
  const res = await fetch(rawUrl(`/api/auth/verify-email/${encodeURIComponent(cleanToken)}`), {
    headers: {
      Accept: 'application/json',
    },
  }).then(async (response) => {
    const payload = (await response.json().catch(() => ({}))) as VerifyEmailResult;
    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload.reason ?? i18next.t('errors.verificationEmailFailed'),
      );
    }
    return payload;
  });

  return res;
}

export async function fetchMe(cookie: string): Promise<User> {
  const res = await fetch(rawUrl('/api/user/me'), {
    headers: { Accept: 'application/json', Cookie: cookie },
  });
  if (res.status === 401) throw new ApiError(401, i18next.t('errors.sessionExpired'));
  if (!res.ok) throw new ApiError(res.status, i18next.t('errors.profileLoadFailed'));
  return (await res.json()) as User;
}

export async function logout(cookie: string | null): Promise<void> {
  if (!cookie) return;
  try {
    const csrfRes = await fetch(rawUrl('/api/auth/csrf'), {
      headers: { Accept: 'application/json', Cookie: cookie },
    });
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    const signoutRequest: RequestInit & { redirect?: 'manual' } = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Auth-Return-Redirect': '1',
        Cookie: cookie,
      },
      body: new URLSearchParams({ csrfToken, json: 'true' }).toString(),
      redirect: 'manual',
    };
    await fetch(rawUrl('/api/auth/signout'), signoutRequest);
  } catch {
    // Best-effort — the client clears local state regardless.
  }
}
