/**
 * Jira (Atlassian) OAuth 3LO helpers.
 *
 * Centralizes scope strings, URL builders, and accessible-resources lookup so
 * the authorize / callback / management routes stay small and declarative.
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */

import { getClientCredentials } from './client-credentials';

export const JIRA_PROVIDER = 'jira';
export const JIRA_STATE_COOKIE = 'tn_jira_state';

export const JIRA_SCOPES = [
  'read:jira-user',
  'read:jira-work',
  'write:jira-work',
  'offline_access',
] as const;

export const JIRA_DEFAULT_SCOPE = JIRA_SCOPES.join(' ');

export const JIRA_AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
export const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
export const JIRA_ACCESSIBLE_RESOURCES_URL =
  'https://api.atlassian.com/oauth/token/accessible-resources';

export type JiraAccessibleResource = {
  id: string;
  url: string;
  name: string;
  scopes?: string[];
  avatarUrl?: string;
};

export type JiraTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type ResolvedJiraCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

function defaultJiraRedirectUri() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/jira/callback`;
}

/**
 * Resolve Jira OAuth client credentials. DB (admin form) first, env vars
 * second — mirroring `getClientCredentials('jira')` but also filling in the
 * redirect uri / scope defaults that are specific to Atlassian 3LO.
 */
export async function getJiraClientCredentials(): Promise<ResolvedJiraCredentials> {
  const credentials = await getClientCredentials('jira');
  if (!credentials) {
    throw new Error(
      'Jira integration is not configured. Add credentials in Admin → Integrations, or set JIRA_CLIENT_ID / JIRA_CLIENT_SECRET.'
    );
  }
  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri ?? defaultJiraRedirectUri(),
    scope: credentials.scope ?? JIRA_DEFAULT_SCOPE,
  };
}

export async function getJiraRedirectUri(): Promise<string> {
  const credentials = await getClientCredentials('jira');
  return credentials?.redirectUri ?? defaultJiraRedirectUri();
}

export async function buildJiraAuthorizeUrl(params: { state: string }): Promise<string> {
  const { clientId, redirectUri, scope } = await getJiraClientCredentials();
  const url = new URL(JIRA_AUTHORIZE_URL);
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scope);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeJiraCode(code: string): Promise<JiraTokenResponse> {
  const { clientId, clientSecret, redirectUri } = await getJiraClientCredentials();
  const response = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Jira token exchange failed (${response.status}): ${text}`);
  }
  return (await response.json()) as JiraTokenResponse;
}

export async function fetchJiraAccessibleResources(
  accessToken: string
): Promise<JiraAccessibleResource[]> {
  const response = await fetch(JIRA_ACCESSIBLE_RESOURCES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch Jira accessible resources (${response.status}): ${text}`
    );
  }
  const data = (await response.json()) as JiraAccessibleResource[];
  return Array.isArray(data) ? data : [];
}
