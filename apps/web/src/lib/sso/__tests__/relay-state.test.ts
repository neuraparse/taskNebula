/**
 * @jest-environment node
 *
 * SAML RelayState mint/verify helper.
 *
 * The helper signs `{ slug, nonce, ts }` with HMAC-SHA256 keyed on
 * `AUTH_SECRET` and rejects tokens older than 5 minutes. These tests
 * exercise the happy path, every named failure mode, and the freshness
 * property that two consecutive mints differ even with identical inputs.
 */

// `relay-state.ts` captures `process.env.AUTH_SECRET` at module-load time,
// so the env var must be set BEFORE the helper module is loaded. ES `import`
// statements are hoisted above top-level code, so we use a CommonJS `require`
// AFTER the assignment to guarantee the ordering.
process.env.AUTH_SECRET = 'test-auth-secret-do-not-use-in-prod';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mintRelayState, verifyRelayState } =
  require('../relay-state') as typeof import('../relay-state');

describe('SAML RelayState helper', () => {
  beforeEach(() => {
    // Belt-and-braces: ensure the env var stays set even if another suite
    // mutated it. The module already closed over its own copy at import,
    // but keeping the env populated avoids surprises if the helper is ever
    // refactored to read it lazily.
    process.env.AUTH_SECRET = 'test-auth-secret-do-not-use-in-prod';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('round-trips: mint then verify returns the original slug', () => {
    const token = mintRelayState('acme');
    const result = verifyRelayState(token);
    expect(result).toEqual({ ok: true, slug: 'acme' });
  });

  it('returns the same slug that was minted, for a different slug', () => {
    const token = mintRelayState('globex');
    const result = verifyRelayState(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slug).toBe('globex');
    }
  });

  it('rejects a tampered payload with reason "bad_signature"', () => {
    const token = mintRelayState('acme');
    const dotIdx = token.indexOf('.');
    expect(dotIdx).toBeGreaterThan(0);
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);

    // Flip the first character of the base64url payload portion.
    const firstChar = payload.charAt(0);
    const flipped = firstChar === 'A' ? 'B' : 'A';
    const tamperedPayload = flipped + payload.slice(1);
    const tampered = `${tamperedPayload}.${sig}`;

    expect(verifyRelayState(tampered)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects a tampered signature with reason "bad_signature"', () => {
    const token = mintRelayState('acme');
    const dotIdx = token.indexOf('.');
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);

    // Flip the last character of the trailing signature.
    const lastChar = sig.charAt(sig.length - 1);
    const flipped = lastChar === 'A' ? 'B' : 'A';
    const tamperedSig = sig.slice(0, -1) + flipped;
    const tampered = `${payload}.${tamperedSig}`;

    expect(verifyRelayState(tampered)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  describe('malformed tokens', () => {
    it('rejects the empty string', () => {
      expect(verifyRelayState('')).toEqual({ ok: false, reason: 'malformed' });
    });

    it('rejects a string with no "."', () => {
      expect(verifyRelayState('no-separator-here')).toEqual({
        ok: false,
        reason: 'malformed',
      });
    });

    it('rejects a bare "." with empty payload and signature', () => {
      expect(verifyRelayState('.')).toEqual({
        ok: false,
        reason: 'malformed',
      });
    });

    it('rejects a token that is only a signature (".sig")', () => {
      expect(verifyRelayState('.abcdef')).toEqual({
        ok: false,
        reason: 'malformed',
      });
    });

    it('rejects a token that is only a payload ("payload.")', () => {
      expect(verifyRelayState('abcdef.')).toEqual({
        ok: false,
        reason: 'malformed',
      });
    });
  });

  it('rejects a token minted 6 minutes ago with reason "expired"', () => {
    const realNow = Date.now();
    const sixMinutesAgo = realNow - 6 * 60 * 1000;

    // First call: mint with the clock rewound 6 minutes.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(sixMinutesAgo);
    const token = mintRelayState('acme');

    // Second call: verify with the real clock restored.
    nowSpy.mockReturnValue(realNow);
    const result = verifyRelayState(token);

    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('produces two different tokens for the same slug on consecutive mints', () => {
    // Pin the clock so the only source of entropy is the nonce.
    const pinned = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(pinned);

    const a = mintRelayState('acme');
    const b = mintRelayState('acme');

    expect(a).not.toBe(b);
    // Sanity: both still verify cleanly.
    expect(verifyRelayState(a)).toEqual({ ok: true, slug: 'acme' });
    expect(verifyRelayState(b)).toEqual({ ok: true, slug: 'acme' });
  });
});
