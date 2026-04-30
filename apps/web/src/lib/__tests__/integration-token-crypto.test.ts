/**
 * @jest-environment node
 *
 * Token crypto round-trip tests.
 *
 * The integration OAuth flow stores access & refresh tokens AES-256-GCM
 * encrypted, with a key derived from AUTH_SECRET. We verify:
 *   - encrypt → decrypt round-trips for ASCII and unicode tokens
 *   - encrypt produces unique ciphertexts for the same plaintext (random IV)
 *   - asTokenEnvelope narrows shape correctly
 *   - tampered ciphertext / authTag fails decryption
 *   - missing AUTH_SECRET throws a clear error
 */

const ORIGINAL_SECRET = process.env.AUTH_SECRET;

beforeAll(() => {
  // Set a stable, sufficiently-long secret for the encryption tests.
  process.env.AUTH_SECRET =
    'test-secret-test-secret-test-secret-test-secret';
});

afterAll(() => {
  process.env.AUTH_SECRET = ORIGINAL_SECRET;
});

import {
  encryptToken,
  decryptToken,
  asTokenEnvelope,
} from '../integrations/token-crypto';

describe('encryptToken / decryptToken round-trip', () => {
  it('round-trips an ASCII token', () => {
    const plaintext = 'gho_1234567890abcdef';
    const enc = encryptToken(plaintext);
    expect(enc).toMatchObject({
      iv: expect.any(String),
      authTag: expect.any(String),
      ciphertext: expect.any(String),
    });
    expect(decryptToken(enc)).toBe(plaintext);
  });

  it('round-trips a unicode token (multi-byte chars)', () => {
    const plaintext = 'tøkén-üñîçødé-🚀';
    const enc = encryptToken(plaintext);
    expect(decryptToken(enc)).toBe(plaintext);
  });

  it('produces unique ciphertexts for identical plaintexts (random IV)', () => {
    const plaintext = 'sentry-tok-abcdef';
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });
});

describe('asTokenEnvelope', () => {
  it('returns the envelope when shape matches', () => {
    const enc = encryptToken('whatever');
    const narrowed = asTokenEnvelope({ ...enc });
    expect(narrowed).toEqual(enc);
  });

  it('returns null on missing fields', () => {
    expect(asTokenEnvelope(null)).toBeNull();
    expect(asTokenEnvelope({})).toBeNull();
    expect(asTokenEnvelope({ iv: 'x', authTag: 'y' })).toBeNull();
    expect(asTokenEnvelope({ iv: 1, authTag: 'y', ciphertext: 'z' })).toBeNull();
  });
});

describe('tamper resistance', () => {
  it('rejects a tampered ciphertext', () => {
    const enc = encryptToken('original');
    const tampered = {
      ...enc,
      // flip a character — base64 still parses but auth tag check fails.
      ciphertext: enc.ciphertext.replace(/^./, (ch) => (ch === 'A' ? 'B' : 'A')),
    };
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('rejects a swapped authTag', () => {
    const enc1 = encryptToken('one');
    const enc2 = encryptToken('two');
    const swapped = { ...enc1, authTag: enc2.authTag };
    expect(() => decryptToken(swapped)).toThrow();
  });
});

describe('missing AUTH_SECRET', () => {
  it('throws a clear error when AUTH_SECRET is unset', () => {
    const original = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      expect(() => encryptToken('x')).toThrow(/AUTH_SECRET/);
    } finally {
      process.env.AUTH_SECRET = original;
    }
  });
});
