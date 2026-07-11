import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientCredentials } from '@/lib/integrations/client-credentials';
import { hasPermission } from '@/lib/auth/permissions';
import { buildGithubAuthorizeUrl } from '@/lib/integrations/github';
import { buildJiraAuthorizeUrl, getJiraClientCredentials } from '@/lib/integrations/jira';
import { buildSentryAuthorizeUrl, getSentryClientCredentials } from '@/lib/integrations/sentry';
import { buildSlackAuthorizeUrl, getSlackClientCredentials } from '@/lib/integrations/slack';
import {
  createMobileIntegrationState,
  type IntegrationOAuthProvider,
} from '@/lib/integrations/mobile-oauth';

export const dynamic = 'force-dynamic';

const PROVIDERS = new Set<IntegrationOAuthProvider>([
  'github',
  'gitlab',
  'jira',
  'sentry',
  'slack',
]);

const GITLAB_AUTHORIZE_URL = 'https://gitlab.com/oauth/authorize';
const GITLAB_DEFAULT_SCOPE = 'read_api read_repository';

async function buildGitlabAuthorizeUrl(state: string): Promise<string> {
  const credentials = await getClientCredentials('gitlab');
  if (!credentials || !credentials.redirectUri) {
    throw new Error('gitlab_oauth_not_configured');
  }

  const url = new URL(GITLAB_AUTHORIZE_URL);
  url.searchParams.set('client_id', credentials.clientId);
  url.searchParams.set('redirect_uri', credentials.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', credentials.scope || GITLAB_DEFAULT_SCOPE);
  url.searchParams.set('state', state);
  return url.toString();
}

async function buildProviderAuthorizeUrl(
  provider: IntegrationOAuthProvider,
  state: string
): Promise<string> {
  if (provider === 'github') return buildGithubAuthorizeUrl({ state });
  if (provider === 'jira') {
    await getJiraClientCredentials();
    return buildJiraAuthorizeUrl({ state });
  }
  if (provider === 'sentry') {
    await getSentryClientCredentials();
    return buildSentryAuthorizeUrl({ state });
  }
  if (provider === 'slack') {
    await getSlackClientCredentials();
    return buildSlackAuthorizeUrl({ state });
  }
  return buildGitlabAuthorizeUrl(state);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const providerParam = request.nextUrl.searchParams.get('provider');
  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!providerParam || !PROVIDERS.has(providerParam as IntegrationOAuthProvider)) {
    return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });
  }
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id_required' }, { status: 400 });
  }
  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const provider = providerParam as IntegrationOAuthProvider;
  try {
    const state = createMobileIntegrationState({
      provider,
      organizationId,
      userId: session.user.id,
    });
    const authorizeUrl = await buildProviderAuthorizeUrl(provider, state);
    return NextResponse.json({ provider, authorizeUrl });
  } catch (err) {
    console.error('[mobile-oauth] authorize failed', err);
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 500 });
  }
}
