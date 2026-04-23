import { createId } from '@paralleldrive/cuid2';
import { db, eq, systemSettings } from '@tasknebula/db';
import {
  decryptSecretEnvelope,
  encryptSecretEnvelope,
  isSecretEnvelope,
  toSecretPreview,
  type SecretEnvelope,
} from './system-crypto';

export const SMTP_CONFIG_KEY = 'smtp_config';
export const LIVEKIT_CONFIG_KEY = 'livekit_config';
export const STORAGE_CONFIG_KEY = 'storage_config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SmtpConfigStored = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: SecretEnvelope | null;
  emailFrom: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type SmtpConfigSanitized = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordPreview: string | null;
  emailFrom: string;
  updatedAt: string | null;
  updatedBy: string | null;
  configured: boolean;
};

export type SmtpConfigInput = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string | null; // optional on update (keep existing when empty)
  emailFrom: string;
};

export type LivekitConfigStored = {
  url: string;
  apiKey: string;
  apiSecret: SecretEnvelope | null;
  updatedAt?: string;
  updatedBy?: string;
};

export type LivekitConfigSanitized = {
  url: string;
  apiKey: string;
  apiSecretPreview: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  configured: boolean;
};

export type LivekitConfigInput = {
  url: string;
  apiKey: string;
  apiSecret?: string | null; // optional on update
};

export type StorageConfigStored = {
  uploadsDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: SecretEnvelope | null;
  updatedAt?: string;
  updatedBy?: string;
};

export type StorageConfigSanitized = {
  uploadsDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKeyPreview: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  configured: boolean;
};

export type StorageConfigInput = {
  uploadsDir: string;
  s3Bucket: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey?: string | null;
};

// ---------------------------------------------------------------------------
// Generic upsert
// ---------------------------------------------------------------------------

async function readRawSetting(key: string): Promise<Record<string, unknown> | null> {
  const [setting] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  const value = setting?.value as Record<string, unknown> | undefined | null;
  return value ?? null;
}

async function writeRawSetting(
  key: string,
  category: string,
  description: string,
  value: Record<string, unknown>,
  userId: string
) {
  const [existing] = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (!existing) {
    await db.insert(systemSettings).values({
      id: createId(),
      key,
      category,
      description,
      value,
      updatedBy: userId,
    });
    return;
  }

  await db
    .update(systemSettings)
    .set({ value, updatedAt: new Date(), updatedBy: userId })
    .where(eq(systemSettings.id, existing.id));
}

// ---------------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------------

export function normalizeSmtpConfig(value: unknown): SmtpConfigStored {
  const raw = (value as Record<string, unknown>) || {};
  const passwordCandidate = raw.password;
  return {
    host: typeof raw.host === 'string' ? raw.host : '',
    port:
      typeof raw.port === 'number' && Number.isFinite(raw.port)
        ? raw.port
        : typeof raw.port === 'string'
          ? parseInt(raw.port, 10) || 25
          : 25,
    secure: raw.secure === true,
    user: typeof raw.user === 'string' ? raw.user : '',
    password: isSecretEnvelope(passwordCandidate) ? passwordCandidate : null,
    emailFrom: typeof raw.emailFrom === 'string' ? raw.emailFrom : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export async function getSmtpConfig(): Promise<SmtpConfigStored> {
  const raw = await readRawSetting(SMTP_CONFIG_KEY);
  return normalizeSmtpConfig(raw);
}

export function sanitizeSmtpConfig(config: SmtpConfigStored): SmtpConfigSanitized {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    passwordPreview: config.password ? config.password.preview : null,
    emailFrom: config.emailFrom,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
    configured: Boolean(config.host),
  };
}

export async function upsertSmtpConfig(
  input: SmtpConfigInput,
  userId: string
): Promise<SmtpConfigStored> {
  const existing = await getSmtpConfig();

  let passwordEnvelope: SecretEnvelope | null = existing.password;
  const trimmedPassword = typeof input.password === 'string' ? input.password.trim() : '';
  if (trimmedPassword) {
    passwordEnvelope = encryptSecretEnvelope(trimmedPassword, userId);
  }

  const next: SmtpConfigStored = {
    host: input.host.trim(),
    port: input.port,
    secure: input.secure,
    user: input.user.trim(),
    password: passwordEnvelope,
    emailFrom: input.emailFrom.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  await writeRawSetting(
    SMTP_CONFIG_KEY,
    'integrations',
    'Platform SMTP credentials (used for invite, notification, and verification emails).',
    next as unknown as Record<string, unknown>,
    userId
  );

  return next;
}

export type ResolvedSmtpConfig = {
  source: 'db' | 'env';
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  emailFrom: string;
};

/**
 * Resolve live SMTP settings, preferring the DB-stored config over env vars.
 * Returns null when nothing is configured at either layer.
 */
export async function resolveSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
  try {
    const stored = await getSmtpConfig();
    if (stored.host) {
      const password = decryptSecretEnvelope(stored.password) || '';
      return {
        source: 'db',
        host: stored.host,
        port: stored.port,
        secure: stored.secure,
        user: stored.user,
        password,
        emailFrom: stored.emailFrom || process.env.EMAIL_FROM || 'TaskNebula <noreply@localhost>',
      };
    }
  } catch (err) {
    console.error('[system-settings] failed to read SMTP from DB, falling back to env:', err);
  }

  if (!process.env.SMTP_HOST) return null;
  return {
    source: 'env',
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '25', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    emailFrom: process.env.EMAIL_FROM || 'TaskNebula <noreply@localhost>',
  };
}

// ---------------------------------------------------------------------------
// LiveKit
// ---------------------------------------------------------------------------

export function normalizeLivekitConfig(value: unknown): LivekitConfigStored {
  const raw = (value as Record<string, unknown>) || {};
  const secretCandidate = raw.apiSecret;
  return {
    url: typeof raw.url === 'string' ? raw.url : '',
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    apiSecret: isSecretEnvelope(secretCandidate) ? secretCandidate : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export async function getLivekitConfigStored(): Promise<LivekitConfigStored> {
  const raw = await readRawSetting(LIVEKIT_CONFIG_KEY);
  return normalizeLivekitConfig(raw);
}

export function sanitizeLivekitConfig(config: LivekitConfigStored): LivekitConfigSanitized {
  return {
    url: config.url,
    apiKey: config.apiKey,
    apiSecretPreview: config.apiSecret ? config.apiSecret.preview : null,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
    configured: Boolean(config.url && config.apiKey && config.apiSecret),
  };
}

export async function upsertLivekitConfig(
  input: LivekitConfigInput,
  userId: string
): Promise<LivekitConfigStored> {
  const existing = await getLivekitConfigStored();

  let secretEnvelope: SecretEnvelope | null = existing.apiSecret;
  const trimmedSecret = typeof input.apiSecret === 'string' ? input.apiSecret.trim() : '';
  if (trimmedSecret) {
    secretEnvelope = encryptSecretEnvelope(trimmedSecret, userId);
  }

  const next: LivekitConfigStored = {
    url: input.url.trim(),
    apiKey: input.apiKey.trim(),
    apiSecret: secretEnvelope,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  await writeRawSetting(
    LIVEKIT_CONFIG_KEY,
    'integrations',
    'Platform LiveKit server credentials (used for realtime audio/video rooms).',
    next as unknown as Record<string, unknown>,
    userId
  );

  return next;
}

export type ResolvedLivekitConfig = {
  source: 'db' | 'env';
  url: string;
  apiKey: string;
  apiSecret: string;
};

/**
 * Resolve live LiveKit credentials, preferring the DB-stored config over env
 * vars. Returns null when nothing is configured at either layer.
 */
export async function resolveLivekitConfig(): Promise<ResolvedLivekitConfig | null> {
  try {
    const stored = await getLivekitConfigStored();
    const apiSecret = decryptSecretEnvelope(stored.apiSecret);
    if (stored.url && stored.apiKey && apiSecret) {
      return {
        source: 'db',
        url: stored.url,
        apiKey: stored.apiKey,
        apiSecret,
      };
    }
  } catch (err) {
    console.error('[system-settings] failed to read LiveKit from DB, falling back to env:', err);
  }

  const envUrl = process.env.LIVEKIT_URL || '';
  const envKey = process.env.LIVEKIT_API_KEY || '';
  const envSecret = process.env.LIVEKIT_API_SECRET || '';
  if (!envUrl || !envKey || !envSecret) return null;
  return {
    source: 'env',
    url: envUrl,
    apiKey: envKey,
    apiSecret: envSecret,
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function normalizeStorageConfig(value: unknown): StorageConfigStored {
  const raw = (value as Record<string, unknown>) || {};
  const secretCandidate = raw.s3SecretKey;
  return {
    uploadsDir: typeof raw.uploadsDir === 'string' ? raw.uploadsDir : '',
    s3Bucket: typeof raw.s3Bucket === 'string' ? raw.s3Bucket : '',
    s3Region: typeof raw.s3Region === 'string' ? raw.s3Region : '',
    s3AccessKey: typeof raw.s3AccessKey === 'string' ? raw.s3AccessKey : '',
    s3SecretKey: isSecretEnvelope(secretCandidate) ? secretCandidate : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export async function getStorageConfig(): Promise<StorageConfigStored> {
  const raw = await readRawSetting(STORAGE_CONFIG_KEY);
  return normalizeStorageConfig(raw);
}

export function sanitizeStorageConfig(config: StorageConfigStored): StorageConfigSanitized {
  return {
    uploadsDir: config.uploadsDir,
    s3Bucket: config.s3Bucket,
    s3Region: config.s3Region,
    s3AccessKey: config.s3AccessKey,
    s3SecretKeyPreview: config.s3SecretKey ? config.s3SecretKey.preview : null,
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
    configured: Boolean(config.uploadsDir || config.s3Bucket),
  };
}

export async function upsertStorageConfig(
  input: StorageConfigInput,
  userId: string
): Promise<StorageConfigStored> {
  const existing = await getStorageConfig();

  let secretEnvelope: SecretEnvelope | null = existing.s3SecretKey;
  const trimmedSecret = typeof input.s3SecretKey === 'string' ? input.s3SecretKey.trim() : '';
  if (trimmedSecret) {
    secretEnvelope = encryptSecretEnvelope(trimmedSecret, userId);
  }

  const next: StorageConfigStored = {
    uploadsDir: input.uploadsDir.trim(),
    s3Bucket: input.s3Bucket.trim(),
    s3Region: input.s3Region.trim(),
    s3AccessKey: input.s3AccessKey.trim(),
    s3SecretKey: secretEnvelope,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  await writeRawSetting(
    STORAGE_CONFIG_KEY,
    'integrations',
    'Platform storage configuration (local uploads dir or S3-compatible bucket).',
    next as unknown as Record<string, unknown>,
    userId
  );

  return next;
}

export { toSecretPreview };
