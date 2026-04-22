/**
 * Token encryption helpers for integration OAuth tokens.
 *
 * Uses AES-256-GCM with a key derived from AUTH_SECRET. The output envelope
 * is intended to be stored as JSONB in the database and is self-describing:
 *
 *   { iv, authTag, ciphertext }  (all base64 strings)
 *
 * IMPORTANT: keep the public API stable — other integration code depends on
 * `encryptToken` / `decryptToken` having this exact shape.
 */

import crypto from 'crypto';

export interface EncryptedTokenEnvelope {
  iv: string;
  authTag: string;
  ciphertext: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // standard for GCM
const KEY_BYTES = 32; // 256 bits

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET is required for integration token encryption and must be at least 16 chars'
    );
  }
  // Derive a 32-byte key via SHA-256 so that any AUTH_SECRET length works.
  return crypto.createHash('sha256').update(secret, 'utf8').digest().subarray(0, KEY_BYTES);
}

export function encryptToken(plaintext: string): EncryptedTokenEnvelope {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken: plaintext must be a non-empty string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: enc.toString('base64'),
  };
}

export function decryptToken(envelope: EncryptedTokenEnvelope | null | undefined): string {
  if (!envelope || !envelope.iv || !envelope.authTag || !envelope.ciphertext) {
    throw new Error('decryptToken: invalid envelope');
  }
  const key = getKey();
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString('utf8');
}
