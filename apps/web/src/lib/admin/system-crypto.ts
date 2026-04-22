import crypto from 'crypto';

/**
 * AES-256-GCM envelope encryption for platform-level system credentials.
 *
 * Mirrors the pattern used in `@/lib/agents/credentials` for AI provider
 * keys, but scoped to admin system settings (SMTP, LiveKit, Storage).
 * The same `AUTH_SECRET` is used as the key-derivation seed so we don't
 * introduce a second secret to manage.
 */

export type SecretEnvelope = {
  iv: string;
  authTag: string;
  ciphertext: string;
  preview: string;
  updatedAt: string;
  updatedBy: string;
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is required to encrypt system credentials.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptRaw(value: string) {
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

function decryptRaw(envelope: Pick<SecretEnvelope, 'iv' | 'authTag' | 'ciphertext'>) {
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

export function toSecretPreview(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const last4 = trimmed.slice(-4);
  return last4 ? `••••${last4}` : 'Configured';
}

export function encryptSecretEnvelope(value: string, userId: string): SecretEnvelope {
  const encrypted = encryptRaw(value);
  return {
    ...encrypted,
    preview: toSecretPreview(value),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

export function decryptSecretEnvelope(envelope: SecretEnvelope | null | undefined): string | null {
  if (!envelope || !envelope.ciphertext) return null;
  try {
    return decryptRaw(envelope);
  } catch (err) {
    console.error('[system-crypto] failed to decrypt envelope', err);
    return null;
  }
}

export function isSecretEnvelope(value: unknown): value is SecretEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SecretEnvelope).iv === 'string' &&
    typeof (value as SecretEnvelope).authTag === 'string' &&
    typeof (value as SecretEnvelope).ciphertext === 'string'
  );
}
