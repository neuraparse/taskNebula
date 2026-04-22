/**
 * Jira (Atlassian) OAuth 3LO helpers.
 *
 * Centralizes scope strings, URL builders, and accessible-resources lookup so
 * the authorize / callback / management routes stay small and declarative.
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 */

export const JIRA_PROVIDER = 'jira';
export const JIRA_STATE_COOKIE = 'tn_jira_state';

export const JIRA_SCOPES = [
  'read:jira-user',
  'read:jira-work',
  'write:jira-work',
  'offline_access',
] as const;

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

export function getJiraClientCredentials() {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Jira integration is not configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.'
    );
  }
  return { clientId, clientSecret };
}

export function getJiraRedirectUri() {
  const explicit = process.env.JIRA_REDIRECT_URI;
  if (explicit) return explicit;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/jira/callback`;
}

export function buildJiraAuthorizeUrl(params: { state: string }) {
  const { clientId } = getJiraClientCredentials();
  const url = new URL(JIRA_AUTHORIZE_URL);
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', JIRA_SCOPES.join(' '));
  url.searchParams.set('redirect_uri', getJiraRedirectUri());
  url.searchParams.set('state', params.state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeJiraCode(code: string): Promise<JiraTokenResponse> {
  const { clientId, clientSecret } = getJiraClientCredentials();
  const response = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getJiraRedirectUri(),
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
