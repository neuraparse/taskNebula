import crypto from 'crypto';
import { db, eq, organizations } from '@tasknebula/db';
import type { AgentProvider } from './config';

export type SecretEnvelope = {
  iv: string;
  authTag: string;
  ciphertext: string;
  preview: string;
  updatedAt: string;
  updatedBy: string;
};

type CredentialKey = 'openai' | 'anthropic';

export type AgentSecretStore = Partial<Record<CredentialKey, SecretEnvelope>>;

export type AgentProviderCredentialStatus = {
  configured: boolean;
  source: 'workspace' | 'platform' | 'server_env' | null;
  label: string | null;
  updatedAt: string | null;
};

const PROVIDER_ENV_KEYS: Partial<Record<AgentProvider, string>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
};

const CREDENTIAL_KEY_FOR_PROVIDER: Partial<Record<AgentProvider, CredentialKey>> = {
  openai: 'openai',
  anthropic: 'anthropic',
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is required to encrypt AI provider credentials.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptSecret(envelope: SecretEnvelope) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getSecretKey(),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

function toPreview(value: string) {
  const trimmed = value.trim();
  const last4 = trimmed.slice(-4);
  return last4 ? `••••${last4}` : 'Configured';
}

function getWorkspaceSecretStore(settings: Record<string, unknown> | null | undefined) {
  const store = settings?.aiAgentSecrets;
  return typeof store === 'object' && store !== null ? (store as AgentSecretStore) : {};
}

/**
 * Credential resolution chain (in priority order):
 *   1. Workspace-scoped (this org entered its own key in Settings → AI & Agents)
 *   2. Platform-scoped (super-admin entered a default key in Admin → Agent control)
 *   3. Server env var (legacy fallback for dev — OPENAI_API_KEY / ANTHROPIC_API_KEY)
 *
 * Returns null when no credential is configured at any layer.
 */
export function getProviderCredentialStatusFromSettings(
  settings: Record<string, unknown> | null | undefined,
  provider: AgentProvider,
  platformStore?: AgentSecretStore | null
): AgentProviderCredentialStatus {
  if (provider === 'native') {
    return {
      configured: true,
      source: 'server_env',
      label: 'Built-in planner',
      updatedAt: null,
    };
  }

  const credKey = CREDENTIAL_KEY_FOR_PROVIDER[provider];
  const workspaceSecrets = getWorkspaceSecretStore(settings);

  if (credKey && workspaceSecrets[credKey]) {
    const envelope = workspaceSecrets[credKey]!;
    return {
      configured: true,
      source: 'workspace',
      label: envelope.preview,
      updatedAt: envelope.updatedAt,
    };
  }

  if (credKey && platformStore?.[credKey]) {
    const envelope = platformStore[credKey]!;
    return {
      configured: true,
      source: 'platform',
      label: `Platform default · ${envelope.preview}`,
      updatedAt: envelope.updatedAt,
    };
  }

  const envKey = PROVIDER_ENV_KEYS[provider];
  const envValue = envKey ? process.env[envKey] : null;
  if (envKey && envValue) {
    return {
      configured: true,
      source: 'server_env',
      label: `${envKey} from server env`,
      updatedAt: null,
    };
  }

  return {
    configured: false,
    source: null,
    label: null,
    updatedAt: null,
  };
}

export function resolveProviderApiKeyFromSettings(
  settings: Record<string, unknown> | null | undefined,
  provider: AgentProvider,
  platformStore?: AgentSecretStore | null
) {
  const credKey = CREDENTIAL_KEY_FOR_PROVIDER[provider];
  if (!credKey) return null;

  const workspaceSecrets = getWorkspaceSecretStore(settings);
  if (workspaceSecrets[credKey]) {
    return decryptSecret(workspaceSecrets[credKey]!);
  }

  if (platformStore?.[credKey]) {
    return decryptSecret(platformStore[credKey]!);
  }

  const envKey = PROVIDER_ENV_KEYS[provider];
  return (envKey && process.env[envKey]) || null;
}

export function upsertProviderSecretInSettings(params: {
  settings: Record<string, unknown> | null | undefined;
  provider: AgentProvider;
  apiKey: string;
  userId: string;
}) {
  const credKey = CREDENTIAL_KEY_FOR_PROVIDER[params.provider];
  if (!credKey) {
    throw new Error(`Provider "${params.provider}" does not support stored credentials.`);
  }

  const currentSettings = { ...(params.settings || {}) };
  const secretStore = { ...getWorkspaceSecretStore(params.settings) };
  const encrypted = encryptSecret(params.apiKey.trim());

  secretStore[credKey] = {
    ...encrypted,
    preview: toPreview(params.apiKey),
    updatedAt: new Date().toISOString(),
    updatedBy: params.userId,
  };

  currentSettings.aiAgentSecrets = secretStore;
  return currentSettings;
}

export function removeProviderSecretFromSettings(params: {
  settings: Record<string, unknown> | null | undefined;
  provider: AgentProvider;
}) {
  const credKey = CREDENTIAL_KEY_FOR_PROVIDER[params.provider];
  const currentSettings = { ...(params.settings || {}) };
  const secretStore = { ...getWorkspaceSecretStore(params.settings) };

  if (credKey && secretStore[credKey]) {
    delete secretStore[credKey];
  }

  currentSettings.aiAgentSecrets = secretStore;
  return currentSettings;
}

export async function getOrganizationSettingsForAgentCredentials(organizationId: string) {
  const [organization] = await db
    .select({
      settings: organizations.settings,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return (organization?.settings as Record<string, unknown> | null | undefined) || null;
}

/**
 * Platform-level credential management — admin-set defaults that all orgs
 * fall back to when they haven't configured their own key.
 * Stored in systemSettings.value.providerCredentials (the same JSONB that
 * holds globalEnabled / allowWriteActions etc.).
 */
export function upsertPlatformSecretInStore(params: {
  store: AgentSecretStore | undefined | null;
  provider: AgentProvider;
  apiKey: string;
  userId: string;
}): AgentSecretStore {
  const credKey = CREDENTIAL_KEY_FOR_PROVIDER[params.provider];
  if (!credKey) {
    throw new Error(`Provider "${params.provider}" cannot be stored as a platform credential.`);
  }
  const next: AgentSecretStore = { ...(params.store || {}) };
  const encrypted = encryptSecret(params.apiKey.trim());
  next[credKey] = {
    ...encrypted,
    preview: toPreview(params.apiKey),
    updatedAt: new Date().toISOString(),
    updatedBy: params.userId,
  };
  return next;
}

export function removePlatformSecretFromStore(params: {
  store: AgentSecretStore | undefined | null;
  provider: AgentProvider;
}): AgentSecretStore {
  const credKey = CREDENTIAL_KEY_FOR_PROVIDER[params.provider];
  const next: AgentSecretStore = { ...(params.store || {}) };
  if (credKey && next[credKey]) {
    delete next[credKey];
  }
  return next;
}

export function sanitizePlatformSecretStore(store: AgentSecretStore | undefined | null) {
  const out: Record<CredentialKey, { preview: string; updatedAt: string; updatedBy: string } | null> = {
    openai: null,
    anthropic: null,
  };
  for (const key of ['openai', 'anthropic'] as const) {
    const envelope = store?.[key];
    if (envelope) {
      out[key] = {
        preview: envelope.preview,
        updatedAt: envelope.updatedAt,
        updatedBy: envelope.updatedBy,
      };
    }
  }
  return out;
}
