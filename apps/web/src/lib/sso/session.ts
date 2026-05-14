/**
 * SAML → Auth.js session bridge.
 *
 * After the ACS handler verifies a SAML response and resolves the user, we
 * need a way to flip that into an Auth.js JWT session. Auth.js v5 doesn't
 * expose a server-side "sign-in this user" API, so we use the documented
 * Credentials-provider pattern with a one-shot exchange token.
 *
 * Flow:
 *   ACS callback  → mintSamlExchangeToken({ userId, email, workspaceId })
 *   Browser POST   → /api/auth/callback/saml-bridge with `token` (handled by
 *                   the `saml-bridge` Credentials provider in auth.ts)
 *
 * Tokens are HMAC-signed with AUTH_SECRET, single-use (`nonce`), and expire
 * after 60 seconds. We persist nonces in-process; since a SAML round-trip
 * takes seconds, this works for single-instance dev. For production HA the
 * nonce store should move to Redis (see `apps/web/src/lib/realtime/`).
 */
import crypto from 'crypto';

const TOKEN_TTL_MS = 60_000;
const SEEN_NONCES = new Map<string, number>();

function secret(): Buffer {
  const raw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      'AUTH_SECRET is required to mint SAML exchange tokens.'
    );
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export type SamlExchangePayload = {
  userId: string;
  email: string;
  workspaceId: string;
  nonce: string;
  exp: number;
};

function pruneExpiredNonces() {
  const now = Date.now();
  for (const [n, exp] of SEEN_NONCES) {
    if (exp < now) SEEN_NONCES.delete(n);
  }
}

export async function mintSamlExchangeToken(input: {
  userId: string;
  email: string;
  workspaceId: string;
}): Promise<string> {
  const payload: SamlExchangePayload = {
    userId: input.userId,
    email: input.email,
    workspaceId: input.workspaceId,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify and consume a SAML exchange token. Returns the payload on success
 * or null on signature / expiry / replay failure.
 */
export async function consumeSamlExchangeToken(
  token: string
): Promise<SamlExchangePayload | null> {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac('sha256', secret())
    .update(body)
    .digest('base64url');
  let ok = false;
  try {
    ok = crypto.timingSafeEqual(
      Buffer.from(sig, 'base64url'),
      Buffer.from(expected, 'base64url')
    );
  } catch {
    ok = false;
  }
  if (!ok) return null;

  let payload: SamlExchangePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as SamlExchangePayload;
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now()) return null;

  pruneExpiredNonces();
  if (SEEN_NONCES.has(payload.nonce)) return null;
  SEEN_NONCES.set(payload.nonce, payload.exp);
  return payload;
}
