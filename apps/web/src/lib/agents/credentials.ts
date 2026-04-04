import crypto from 'crypto';
import { db, eq, organizations } from '@tasknebula/db';
import type { AgentProvider } from './config';

type SecretEnvelope = {
  iv: string;
  authTag: string;
  ciphertext: string;
  preview: string;
  updatedAt: string;
  updatedBy: string;
};

type AgentSecretStore = Partial<Record<'openai', SecretEnvelope>>;

export type AgentProviderCredentialStatus = {
  configured: boolean;
  source: 'workspace' | 'server_env' | null;
  label: string | null;
  updatedAt: string | null;
};

const PROVIDER_ENV_KEYS: Partial<Record<AgentProvider, string>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is required to encrypt workspace AI provider credentials.');
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

function getSecretStore(settings: Record<string, unknown> | null | undefined) {
  const store = settings?.aiAgentSecrets;
  return typeof store === 'object' && store !== null ? (store as AgentSecretStore) : {};
}

export function getProviderCredentialStatusFromSettings(
  settings: Record<string, unknown> | null | undefined,
  provider: AgentProvider
): AgentProviderCredentialStatus {
  const envKey = PROVIDER_ENV_KEYS[provider];
  const envValue = envKey ? process.env[envKey] : null;

  if (provider === 'native') {
    return {
      configured: true,
      source: 'server_env',
      label: 'Built-in planner',
      updatedAt: null,
    };
  }

  const secrets = getSecretStore(settings);
  if (provider === 'openai' && secrets.openai) {
    return {
      configured: true,
      source: 'workspace',
      label: secrets.openai.preview,
      updatedAt: secrets.openai.updatedAt,
    };
  }

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
  provider: AgentProvider
) {
  if (provider !== 'openai') {
    return null;
  }

  const secrets = getSecretStore(settings);
  if (secrets.openai) {
    return decryptSecret(secrets.openai);
  }

  return process.env.OPENAI_API_KEY || null;
}

export function upsertProviderSecretInSettings(params: {
  settings: Record<string, unknown> | null | undefined;
  provider: AgentProvider;
  apiKey: string;
  userId: string;
}) {
  const currentSettings = { ...(params.settings || {}) };
  const secretStore = { ...getSecretStore(params.settings) };
  const encrypted = encryptSecret(params.apiKey.trim());

  if (params.provider === 'openai') {
    secretStore.openai = {
      ...encrypted,
      preview: toPreview(params.apiKey),
      updatedAt: new Date().toISOString(),
      updatedBy: params.userId,
    };
  }

  currentSettings.aiAgentSecrets = secretStore;
  return currentSettings;
}

export function removeProviderSecretFromSettings(params: {
  settings: Record<string, unknown> | null | undefined;
  provider: AgentProvider;
}) {
  const currentSettings = { ...(params.settings || {}) };
  const secretStore = { ...getSecretStore(params.settings) };

  if (params.provider === 'openai') {
    delete secretStore.openai;
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
