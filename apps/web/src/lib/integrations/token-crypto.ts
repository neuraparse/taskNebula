/**
 * Token crypto for integration OAuth connections.
 *
 * Thin AES-256-GCM wrapper around Node's `crypto` module. The key is derived
 * by sha256-hashing AUTH_SECRET (or NEXTAUTH_SECRET as a fallback), matching
 * the pattern used by `apps/web/src/lib/agents/credentials.ts` for AI
 * provider secrets so we have one consistent key-derivation story.
 *
 * Envelopes are plain JSON objects with base64-encoded iv/authTag/ciphertext,
 * safe to store in a JSONB column.
 */
import crypto from 'crypto';

export type TokenEnvelope = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET is required to encrypt integration connection tokens.'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(plaintext: string): TokenEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptToken(envelope: TokenEnvelope): string {
  if (!envelope?.iv || !envelope?.authTag || !envelope?.ciphertext) {
    throw new Error('Invalid token envelope.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Narrow an unknown JSONB value pulled from the DB into a TokenEnvelope, or
 * `null` if it doesn't have the expected shape. Useful when decoding the
 * `accessTokenEnc` / `refreshTokenEnc` columns.
 */
export function asTokenEnvelope(value: unknown): TokenEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.iv === 'string' &&
    typeof v.authTag === 'string' &&
    typeof v.ciphertext === 'string'
  ) {
    return { iv: v.iv, authTag: v.authTag, ciphertext: v.ciphertext };
  }
  return null;
}
