/**
 * Platform-level OAuth client credential resolver.
 *
 * Super-admins can configure client id / client secret (and optional redirect
 * uri / scope) for each integration provider from the admin dashboard. Those
 * values are stored encrypted in `integration_client_credentials`. If no DB
 * row exists for a provider, we transparently fall back to the historical
 * environment variables so existing deployments keep working unchanged.
 *
 * All routes that initiate an OAuth authorize / token exchange should call
 * `getClientCredentials(provider)` instead of reading env vars directly.
 */
import { db, eq } from '@tasknebula/db';
import { integrationClientCredentials } from '@tasknebula/db/src/schema/integration-client-credentials';
import {
  asTokenEnvelope,
  decryptToken,
  encryptToken,
  type TokenEnvelope,
} from './token-crypto';

export type IntegrationProvider =
  | 'slack'
  | 'gitlab'
  | 'jira'
  | 'github'
  | 'google'
  | 'sentry';

export const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  'slack',
  'gitlab',
  'jira',
  'github',
  'google',
  'sentry',
] as const;

export type ClientCredentials = {
  provider: IntegrationProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string | null;
  scope: string | null;
  /** 'db' when the credential came from the admin form, 'env' when from env vars. */
  source: 'db' | 'env';
};

type EnvFallback = {
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv?: string;
  scopeEnv?: string;
};

const ENV_FALLBACKS: Record<IntegrationProvider, EnvFallback> = {
  slack: {
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    redirectUriEnv: 'SLACK_REDIRECT_URI',
  },
  gitlab: {
    clientIdEnv: 'GITLAB_CLIENT_ID',
    clientSecretEnv: 'GITLAB_CLIENT_SECRET',
    redirectUriEnv: 'GITLAB_REDIRECT_URI',
    scopeEnv: 'GITLAB_OAUTH_SCOPE',
  },
  jira: {
    clientIdEnv: 'JIRA_CLIENT_ID',
    clientSecretEnv: 'JIRA_CLIENT_SECRET',
    redirectUriEnv: 'JIRA_REDIRECT_URI',
  },
  github: {
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    redirectUriEnv: 'GITHUB_INTEGRATION_REDIRECT_URI',
    scopeEnv: 'GITHUB_OAUTH_SCOPE',
  },
  google: {
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  sentry: {
    clientIdEnv: 'SENTRY_CLIENT_ID',
    clientSecretEnv: 'SENTRY_CLIENT_SECRET',
    redirectUriEnv: 'SENTRY_REDIRECT_URI',
    scopeEnv: 'SENTRY_OAUTH_SCOPE',
  },
};

export function isIntegrationProvider(value: unknown): value is IntegrationProvider {
  return (
    typeof value === 'string' &&
    (INTEGRATION_PROVIDERS as readonly string[]).includes(value)
  );
}

function readEnv(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function decryptEnvelope(value: unknown): string | null {
  const envelope = asTokenEnvelope(value);
  if (!envelope) return null;
  try {
    return decryptToken(envelope);
  } catch {
    return null;
  }
}

/**
 * Fetch OAuth client credentials for a provider, preferring the DB row written
 * by the admin form and falling back to environment variables. Returns `null`
 * when neither source yields a usable client id + secret pair.
 */
export async function getClientCredentials(
  provider: IntegrationProvider
): Promise<ClientCredentials | null> {
  const [row] = await db
    .select()
    .from(integrationClientCredentials)
    .where(eq(integrationClientCredentials.provider, provider))
    .limit(1);

  if (row) {
    const clientId = decryptEnvelope(row.clientIdEnc);
    const clientSecret = decryptEnvelope(row.clientSecretEnc);
    if (clientId && clientSecret) {
      return {
        provider,
        clientId,
        clientSecret,
        redirectUri: row.redirectUri ?? null,
        scope: row.scope ?? null,
        source: 'db',
      };
    }
  }

  const fallback = ENV_FALLBACKS[provider];
  const clientId = readEnv(fallback.clientIdEnv);
  const clientSecret = readEnv(fallback.clientSecretEnv);
  if (!clientId || !clientSecret) return null;

  return {
    provider,
    clientId,
    clientSecret,
    redirectUri: readEnv(fallback.redirectUriEnv) ?? null,
    scope: readEnv(fallback.scopeEnv) ?? null,
    source: 'env',
  };
}

/**
 * Summary of a provider's configuration — safe to return to the admin UI.
 * Never contains the plaintext secret; `clientIdPreview` only shows the last
 * four characters of the client id so admins can confirm which app is wired.
 */
export type ClientCredentialSummary = {
  provider: IntegrationProvider;
  configured: boolean;
  source: 'db' | 'env' | null;
  clientIdPreview: string | null;
  redirectUri: string | null;
  scope: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

function preview(value: string): string {
  const tail = value.slice(-4);
  return `••••${tail}`;
}

export async function listClientCredentialSummaries(): Promise<
  ClientCredentialSummary[]
> {
  const rows = await db.select().from(integrationClientCredentials);
  const rowByProvider = new Map(rows.map((row) => [row.provider, row]));

  return INTEGRATION_PROVIDERS.map<ClientCredentialSummary>((provider) => {
    const row = rowByProvider.get(provider);
    if (row) {
      const clientId = decryptEnvelope(row.clientIdEnc);
      const clientSecret = decryptEnvelope(row.clientSecretEnc);
      if (clientId && clientSecret) {
        return {
          provider,
          configured: true,
          source: 'db',
          clientIdPreview: preview(clientId),
          redirectUri: row.redirectUri ?? null,
          scope: row.scope ?? null,
          updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
          updatedBy: row.updatedBy ?? null,
        };
      }
    }

    const fallback = ENV_FALLBACKS[provider];
    const envClientId = readEnv(fallback.clientIdEnv);
    const envClientSecret = readEnv(fallback.clientSecretEnv);
    if (envClientId && envClientSecret) {
      return {
        provider,
        configured: true,
        source: 'env',
        clientIdPreview: preview(envClientId),
        redirectUri: readEnv(fallback.redirectUriEnv) ?? null,
        scope: readEnv(fallback.scopeEnv) ?? null,
        updatedAt: null,
        updatedBy: null,
      };
    }

    return {
      provider,
      configured: false,
      source: null,
      clientIdPreview: null,
      redirectUri: null,
      scope: null,
      updatedAt: null,
      updatedBy: null,
    };
  });
}

export function encryptClientValue(plaintext: string): TokenEnvelope {
  return encryptToken(plaintext);
}
