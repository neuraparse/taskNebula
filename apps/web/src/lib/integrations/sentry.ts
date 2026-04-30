/**
 * Sentry OAuth integration helpers.
 *
 * Sentry uses an OAuth 2.0 flow rooted at sentry.io (or a self-hosted host
 * configured via SENTRY_BASE_URL). The token endpoint returns access token,
 * refresh token, and the connected `organization` slug which we surface as
 * the externalAccount label so users can confirm which Sentry org they
 * authorized.
 *
 * Docs: https://docs.sentry.io/api/auth/
 */

import { getClientCredentials } from './client-credentials';

export const SENTRY_PROVIDER = 'sentry';
export const SENTRY_STATE_COOKIE = 'tn_sentry_state';

// `org:read project:read event:read` is the smallest set that supports
// reading issues + creating relationships. Admins can override.
export const SENTRY_DEFAULT_SCOPE = 'org:read project:read event:read';

function sentryBaseUrl(): string {
  const base = process.env.SENTRY_BASE_URL || 'https://sentry.io';
  return base.replace(/\/$/, '');
}

export function sentryAuthorizeUrl(): string {
  return `${sentryBaseUrl()}/oauth/authorize/`;
}

export function sentryTokenUrl(): string {
  return `${sentryBaseUrl()}/oauth/token/`;
}

export function sentryApiBase(): string {
  return `${sentryBaseUrl()}/api/0`;
}

export type SentryTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  scope?: string;
  user?: { id?: string; email?: string; name?: string };
  organization?: { slug?: string; name?: string; id?: string };
  error?: string;
  error_description?: string;
};

type ResolvedSentryCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

function defaultSentryRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/sentry/callback`;
}

export async function getSentryClientCredentials(): Promise<ResolvedSentryCredentials> {
  const credentials = await getClientCredentials('sentry');
  if (!credentials) {
    throw new Error(
      'Sentry integration is not configured. Add credentials in Admin → Integrations, or set SENTRY_CLIENT_ID / SENTRY_CLIENT_SECRET.'
    );
  }
  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri ?? defaultSentryRedirectUri(),
    scope: credentials.scope ?? SENTRY_DEFAULT_SCOPE,
  };
}

export async function buildSentryAuthorizeUrl(params: {
  state: string;
}): Promise<string> {
  const { clientId, redirectUri, scope } = await getSentryClientCredentials();
  const url = new URL(sentryAuthorizeUrl());
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', params.state);
  return url.toString();
}

export async function exchangeSentryCode(
  code: string
): Promise<SentryTokenResponse> {
  const { clientId, clientSecret, redirectUri } =
    await getSentryClientCredentials();

  const response = await fetch(sentryTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
    cache: 'no-store',
  });

  return (await response.json()) as SentryTokenResponse;
}
