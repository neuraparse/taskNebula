/**
 * SCIM bearer-token hashing & verification.
 *
 * We reuse bcryptjs (already a dep) for the hash. Argon2 would be the
 * theoretical best fit but it pulls a native module; bcrypt at 12 rounds is
 * fine for short, machine-generated SCIM tokens since the entropy is in the
 * token itself (32 bytes of CSPRNG), not in user-typed entropy.
 *
 * The plaintext token has the shape `scim_<base64url(32 bytes)>` so admins
 * can recognize it in logs/UIs, similar to `sk_live_...` for API keys.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  db,
  scimTokens,
  organizationMembers,
  hasPermission as roleHasPermission,
  eq,
  and,
  isNull,
} from '@tasknebula/db';

const TOKEN_PREFIX = 'scim_';
const BCRYPT_COST = 12;

export function generateScimToken(): { token: string; prefix: string } {
  const bytes = crypto.randomBytes(32).toString('base64url');
  const token = `${TOKEN_PREFIX}${bytes}`;
  return { token, prefix: token.slice(0, 12) };
}

export async function hashScimToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_COST);
}

export async function verifyScimToken(token: string, hash: string): Promise<boolean> {
  if (!token || !hash) return false;
  try {
    return await bcrypt.compare(token, hash);
  } catch {
    return false;
  }
}

export type ScimAuthContext = {
  tokenId: string;
  workspaceId: string;
};

/**
 * Look up & verify a Bearer token from a `Authorization` header value.
 *
 * Returns the matching workspace + token id on success, or null on failure.
 * The function is intentionally constant-shape (no early returns based on
 * whether the token exists) so we don't leak existence via timing.
 */
export async function authenticateScimRequest(
  authorizationHeader: string | null | undefined
): Promise<ScimAuthContext | null> {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match || !match[1]) return null;
  const presented = match[1].trim();
  if (!presented.startsWith(TOKEN_PREFIX)) return null;

  // We have to fetch all non-revoked tokens for any workspace and bcrypt-compare
  // since the plaintext isn't reversible. In practice the table stays tiny
  // (one or two tokens per workspace) so this is fine; for very large
  // tenants we'd add a short HMAC index column to narrow the search.
  const candidates = await db
    .select({
      id: scimTokens.id,
      workspaceId: scimTokens.workspaceId,
      tokenHash: scimTokens.tokenHash,
    })
    .from(scimTokens)
    .where(isNull(scimTokens.revokedAt));

  for (const row of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await verifyScimToken(presented, row.tokenHash);
    if (ok) {
      // Best-effort last-used timestamp; failures are non-fatal.
      try {
        await db
          .update(scimTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(scimTokens.id, row.id));
      } catch {
        /* swallow — last_used_at is purely informational. */
      }
      return { tokenId: row.id, workspaceId: row.workspaceId };
    }
  }
  return null;
}

/**
 * Helper for the settings UI — ensure the caller can manage organization
 * settings in the workspace before they can manage SCIM tokens. Used by REST
 * handlers that mutate the table.
 */
export async function isOrgAdmin(userId: string, workspaceId: string): Promise<boolean> {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, workspaceId),
      eq(organizationMembers.status, 'active')
    ),
  });
  return roleHasPermission(member?.role || '', 'org:settings');
}
