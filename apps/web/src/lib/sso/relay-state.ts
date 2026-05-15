/**
 * Signed SAML RelayState helper.
 *
 * SAML's `RelayState` parameter is opaque server state echoed by the IdP
 * verbatim on the callback. We use it as a CSRF and replay-window guard:
 * the init route signs `{ slug, nonce, ts }` with the platform secret,
 * and the callback rejects any response whose RelayState fails the HMAC
 * check, is older than `MAX_AGE_MS`, or carries a different workspace
 * slug than the one the callback URL claims to serve. The workspace-slug
 * cookie already mitigates open-redirect; this hardens that with a
 * cryptographic binding that travels through the IdP round-trip.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 5 * 60 * 1000; // 5-minute callback window

// Read `AUTH_SECRET` per-call instead of at module load. The latter form
// captures `''` whenever the env var is set after the import resolves
// (tests, scripts that mutate process.env), and every subsequent call
// throws. Reading per-call costs nothing and is footgun-free.
function secret(): string {
  const value = process.env.AUTH_SECRET ?? '';
  if (!value) throw new Error('AUTH_SECRET must be set to mint a SAML RelayState');
  return value;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest());
}

export function mintRelayState(slug: string): string {
  const nonce = b64url(randomBytes(12));
  const ts = Date.now().toString(36);
  const payload = `${slug}|${nonce}|${ts}`;
  const sig = sign(payload);
  return `${b64url(Buffer.from(payload, 'utf8'))}.${sig}`;
}

export type RelayStateVerifyResult =
  | { ok: true; slug: string }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyRelayState(token: string): RelayStateVerifyResult {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' };
  }
  const [payloadPart, sigPart] = token.split('.', 2);
  if (!payloadPart || !sigPart) return { ok: false, reason: 'malformed' };

  let payloadString: string;
  try {
    payloadString = fromB64url(payloadPart).toString('utf8');
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  let expectedSig: string;
  try {
    expectedSig = sign(payloadString);
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const [slug, _nonce, tsB36] = payloadString.split('|');
  if (!slug || !tsB36) return { ok: false, reason: 'malformed' };
  const ts = parseInt(tsB36, 36);
  if (!Number.isFinite(ts) || Date.now() - ts > MAX_AGE_MS) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, slug };
}
