/**
 * GitHub OAuth integration helpers.
 *
 * Centralizes scope strings, URL builders, and the user-info lookup so the
 * authorize / callback / management routes stay small and declarative.
 *
 * Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */

import { getClientCredentials } from './client-credentials';

export const GITHUB_PROVIDER = 'github';
export const GITHUB_STATE_COOKIE = 'tn_github_state';

// `repo` is required for issue / pull-request sync; `read:user` for the
// account label shown in the UI. Admins can override via the Admin →
// Integrations panel or GITHUB_OAUTH_SCOPE.
export const GITHUB_DEFAULT_SCOPE = 'repo read:user';

export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_URL = 'https://api.github.com/user';
export const GITHUB_REVOKE_URL_BASE =
  'https://api.github.com/applications'; // /:client_id/grant — DELETE

export type GithubTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type GithubUser = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string;
};

type ResolvedGithubCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

function defaultGithubRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/github/callback`;
}

/**
 * Resolve GitHub OAuth client credentials. DB (admin form) first, env vars
 * second, with sane defaults filled in for redirect URI and scope.
 */
export async function getGithubClientCredentials(): Promise<ResolvedGithubCredentials> {
  const credentials = await getClientCredentials('github');
  if (!credentials) {
    throw new Error(
      'GitHub integration is not configured. Add credentials in Admin → Integrations, or set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.'
    );
  }
  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri ?? defaultGithubRedirectUri(),
    scope: credentials.scope ?? GITHUB_DEFAULT_SCOPE,
  };
}

export async function buildGithubAuthorizeUrl(params: {
  state: string;
}): Promise<string> {
  const { clientId, redirectUri, scope } = await getGithubClientCredentials();
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', params.state);
  // Force consent so users see what TaskNebula will access.
  url.searchParams.set('allow_signup', 'true');
  return url.toString();
}

export async function exchangeGithubCode(
  code: string
): Promise<GithubTokenResponse> {
  const { clientId, clientSecret, redirectUri } =
    await getGithubClientCredentials();

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
    cache: 'no-store',
  });

  // GitHub returns 200 even on error — the body carries `error` instead.
  return (await response.json()) as GithubTokenResponse;
}

export async function fetchGithubUser(
  accessToken: string
): Promise<GithubUser | null> {
  try {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub requires a User-Agent for application requests.
        'User-Agent': 'TaskNebula-Integration',
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as GithubUser;
  } catch {
    return null;
  }
}

/**
 * Best-effort upstream revoke — uses the `/applications/{client_id}/grant`
 * endpoint which requires HTTP Basic auth with the client id + secret. Errors
 * are swallowed because we always want to delete our local row regardless.
 */
export async function revokeGithubGrant(accessToken: string): Promise<void> {
  let credentials: ResolvedGithubCredentials;
  try {
    credentials = await getGithubClientCredentials();
  } catch {
    return;
  }
  try {
    const auth = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`
    ).toString('base64');
    await fetch(`${GITHUB_REVOKE_URL_BASE}/${credentials.clientId}/grant`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'TaskNebula-Integration',
      },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch (err) {
    console.warn('GitHub grant revoke failed (ignored)', err);
  }
}
