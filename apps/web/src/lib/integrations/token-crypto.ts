/**
 * Token Crypto — AES-256-GCM envelope encryption for integration OAuth tokens.
 *
 * Shared helper for the `integration_connections` table. All provider access /
 * refresh tokens are stored as `{ iv, authTag, ciphertext }` base64 envelopes
 * encrypted with a key derived from `AUTH_SECRET`.
 *
 * NOTE: This file may also be written by other integration agents (Slack,
 * GitLab, etc.). The implementation is intentionally minimal and stable so
 * the various connectors share the exact same envelope format.
 */

import crypto from 'crypto';

export type EncryptedTokenEnvelope = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is required to encrypt integration tokens.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string into a storable envelope. Returns base64 fields
 * so the result can be persisted directly as JSONB.
 */
export function encryptToken(plaintext: string): EncryptedTokenEnvelope {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken: plaintext must be a non-empty string.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/**
 * Decrypt an envelope produced by `encryptToken`. Throws if the envelope has
 * been tampered with or the AUTH_SECRET has changed.
 */
export function decryptToken(envelope: EncryptedTokenEnvelope): string {
  if (!envelope || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new Error('decryptToken: envelope is missing required fields.');
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
 * Narrow JSONB -> envelope guard. Returns null when the stored value is not a
 * valid envelope (e.g. when a provider doesn't issue refresh tokens).
 */
export function asEnvelope(value: unknown): EncryptedTokenEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<EncryptedTokenEnvelope>;
  if (
    typeof maybe.iv !== 'string' ||
    typeof maybe.authTag !== 'string' ||
    typeof maybe.ciphertext !== 'string'
  ) {
    return null;
  }
  return maybe as EncryptedTokenEnvelope;
}
